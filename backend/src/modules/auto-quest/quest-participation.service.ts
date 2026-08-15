import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModulesRegistryService } from '../../modules-registry/modules-registry.service';
import { ChatBridgeService } from '../../chat-bridge/chat-bridge.service';
import { PushNotificationService } from '../../push/push-notification.service';

const MODULE_KEY = 'auto-quest';

// Участнический флоу: список активных квестов, погашение чекпоинта по
// секретному коду, лидерборд квеста. Начисление баллов — всегда через
// ModulesRegistryService.applyStatEventWithinTransaction, никогда
// напрямую в User.pointsTotal (см. docs/DECISIONS.md — "Игровые
// модули — физическое размещение кода").
@Injectable()
export class QuestParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesRegistry: ModulesRegistryService,
    private readonly chatBridge: ChatBridgeService,
    private readonly push: PushNotificationService,
  ) {}

  async listActive(userId: string) {
    await this.modulesRegistry.assertEnabled(MODULE_KEY);

    const quests = await this.prisma.quest.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        checkpoints: {
          orderBy: { order: 'asc' },
          include: { redemptions: { where: { userId }, select: { id: true } } },
        },
      },
    });

    return quests.map((quest) => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      startsAt: quest.startsAt,
      endsAt: quest.endsAt,
      checkpoints: quest.checkpoints.map((cp) => ({
        id: cp.id,
        title: cp.title,
        description: cp.description,
        points: cp.points,
        order: cp.order,
        completed: cp.redemptions.length > 0,
      })),
    }));
  }

  async redeem(checkpointId: string, userId: string, rawCode: string) {
    await this.modulesRegistry.assertEnabled(MODULE_KEY);

    const checkpoint = await this.prisma.questCheckpoint.findUnique({
      where: { id: checkpointId },
      include: { quest: true },
    });
    if (!checkpoint) throw new NotFoundException('Чекпоинт не найден');

    const { quest } = checkpoint;
    const now = new Date();
    if (!quest.isActive) throw new ForbiddenException('Квест завершён');
    if (quest.startsAt && now < quest.startsAt) throw new ForbiddenException('Квест ещё не начался');
    if (quest.endsAt && now > quest.endsAt) throw new ForbiddenException('Квест уже завершён');
    if (rawCode.trim().toUpperCase() !== checkpoint.code) throw new BadRequestException('Неверный код');

    let result: { checkpoint: typeof checkpoint; quest: typeof quest };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const redemption = await tx.questCheckpointRedemption.create({ data: { checkpointId, userId } });
        const { statEvent } = await this.modulesRegistry.applyStatEventWithinTransaction(tx, {
          moduleKey: MODULE_KEY,
          userId,
          points: checkpoint.points,
          reason: `Чекпоинт "${checkpoint.title}" квеста "${quest.title}"`,
          occurredAt: now,
          metadata: { questId: quest.id, checkpointId },
        });
        await tx.questCheckpointRedemption.update({ where: { id: redemption.id }, data: { statEventId: statEvent.id } });
        return { checkpoint, quest };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Вы уже погасили этот чекпоинт');
      }
      throw error;
    }

    void this.announceRedemption(userId, result.checkpoint, result.quest);
    void this.push.sendToUser(
      userId,
      'Чекпоинт пройден',
      `«${result.checkpoint.title}» — начислено ${result.checkpoint.points} баллов`,
    );

    return { checkpointId: result.checkpoint.id, questId: result.quest.id, points: result.checkpoint.points };
  }

  async leaderboard(questId: string, limit = 20) {
    const redemptions = await this.prisma.questCheckpointRedemption.findMany({
      where: { checkpoint: { questId } },
      include: { checkpoint: { select: { points: true } } },
    });

    const pointsByUser = new Map<string, number>();
    for (const r of redemptions) {
      pointsByUser.set(r.userId, (pointsByUser.get(r.userId) ?? 0) + r.checkpoint.points);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(pointsByUser.keys()) } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return Array.from(pointsByUser.entries())
      .map(([userId, points]) => ({ user: byId.get(userId), points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }

  private async announceRedemption(
    userId: string,
    checkpoint: { title: string; points: number },
    quest: { id: string; title: string },
  ): Promise<void> {
    const moduleDef = await this.prisma.moduleDefinition.findUnique({ where: { key: MODULE_KEY } });
    const config = (moduleDef?.config as { announceRoomId?: string } | null) ?? {};
    if (!config.announceRoomId) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    const text = `${user?.displayName ?? 'Участник'} прошёл чекпоинт «${checkpoint.title}» квеста «${quest.title}» (+${checkpoint.points})`;
    await this.chatBridge.postSystemMessage(config.announceRoomId, text);
  }
}
