import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModulesRegistryService } from '../../modules-registry/modules-registry.service';
import { ChatBridgeService } from '../../chat-bridge/chat-bridge.service';
import { PushNotificationService } from '../../push/push-notification.service';

const MODULE_KEY = 'hide-and-seek';

// Участнический флоу: список активных раундов, погашение раунда по
// секретному коду (называется hider'ом лично при встрече), лидерборд
// раунда. Начисление баллов — всегда через
// ModulesRegistryService.applyStatEventWithinTransaction, никогда
// напрямую в User.pointsTotal (см. docs/DECISIONS.md — "Игровые
// модули — физическое размещение кода").
@Injectable()
export class RoundParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesRegistry: ModulesRegistryService,
    private readonly chatBridge: ChatBridgeService,
    private readonly push: PushNotificationService,
  ) {}

  async listActive(userId: string) {
    await this.modulesRegistry.assertEnabled(MODULE_KEY);

    const rounds = await this.prisma.hideAndSeekRound.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        points: true,
        hiderUserId: true,
        hider: { select: { id: true, displayName: true } },
        finds: { where: { seekerUserId: userId }, select: { id: true } },
      },
    });

    return rounds.map((round) => ({
      id: round.id,
      title: round.title,
      description: round.description,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      points: round.points,
      hider: round.hider,
      iAmHider: round.hiderUserId === userId,
      found: round.finds.length > 0,
    }));
  }

  async find(roundId: string, userId: string, rawCode: string) {
    await this.modulesRegistry.assertEnabled(MODULE_KEY);

    const round = await this.prisma.hideAndSeekRound.findUnique({
      where: { id: roundId },
      include: { hider: { select: { displayName: true } } },
    });
    if (!round) throw new NotFoundException('Раунд не найден');

    const now = new Date();
    if (!round.isActive) throw new ForbiddenException('Раунд завершён');
    if (round.startsAt && now < round.startsAt) throw new ForbiddenException('Раунд ещё не начался');
    if (round.endsAt && now > round.endsAt) throw new ForbiddenException('Раунд уже завершён');
    if (userId === round.hiderUserId) throw new BadRequestException('Нельзя погасить раунд, в котором вы прячетесь');
    if (rawCode.trim().toUpperCase() !== round.code) throw new BadRequestException('Неверный код');

    try {
      await this.prisma.$transaction(async (tx) => {
        const find = await tx.hideAndSeekFind.create({ data: { roundId, seekerUserId: userId } });
        const { statEvent } = await this.modulesRegistry.applyStatEventWithinTransaction(tx, {
          moduleKey: MODULE_KEY,
          userId,
          points: round.points,
          reason: `Раунд «${round.title}» — нашли ${round.hider.displayName}`,
          occurredAt: now,
          metadata: { roundId },
        });
        await tx.hideAndSeekFind.update({ where: { id: find.id }, data: { statEventId: statEvent.id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Вы уже получили баллы за этот раунд');
      }
      throw error;
    }

    void this.announceFind(userId, round);
    void this.push.sendToUser(userId, 'Найден!', `Раунд «${round.title}» — начислено ${round.points} баллов`);

    return { roundId: round.id, points: round.points };
  }

  async leaderboard(roundId: string, limit = 20) {
    const round = await this.prisma.hideAndSeekRound.findUnique({ where: { id: roundId }, select: { points: true } });
    if (!round) throw new NotFoundException('Раунд не найден');

    const finds = await this.prisma.hideAndSeekFind.findMany({
      where: { roundId },
      orderBy: { foundAt: 'asc' },
      take: limit,
      include: { seeker: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    return finds.map((f) => ({ user: f.seeker, points: round.points, foundAt: f.foundAt }));
  }

  private async announceFind(userId: string, round: { id: string; title: string; points: number; hider: { displayName: string } }): Promise<void> {
    const moduleDef = await this.prisma.moduleDefinition.findUnique({ where: { key: MODULE_KEY } });
    const config = (moduleDef?.config as { announceRoomId?: string } | null) ?? {};
    if (!config.announceRoomId) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    const text = `${user?.displayName ?? 'Участник'} нашёл ${round.hider.displayName} в раунде «${round.title}» (+${round.points})`;
    await this.chatBridge.postSystemMessage(config.announceRoomId, text);
  }
}
