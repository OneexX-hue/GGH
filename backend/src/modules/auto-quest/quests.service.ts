import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { generateRandomCode } from '../../common/utils/random-code.util';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';

// Админ-CRUD квестов/чекпоинтов (право modules.manage, см. quests.controller.ts).
// Начисление баллов участникам — не здесь, см. quest-participation.service.ts.
@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list() {
    return this.prisma.quest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { checkpoints: true } } },
    });
  }

  async getDetail(id: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      include: { checkpoints: { orderBy: { order: 'asc' } } },
    });
    if (!quest) throw new NotFoundException('Квест не найден');
    return quest;
  }

  async create(dto: CreateQuestDto, actorUserId: string, ipAddress?: string) {
    const quest = await this.prisma.quest.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        createdByUserId: actorUserId,
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'quest.create',
      targetType: 'Quest',
      targetId: quest.id,
      metadata: { title: quest.title },
      ipAddress,
    });

    return quest;
  }

  async update(id: string, dto: UpdateQuestDto, actorUserId: string, ipAddress?: string) {
    const existing = await this.prisma.quest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Квест не найден');

    const updated = await this.prisma.quest.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'quest.update',
      targetType: 'Quest',
      targetId: id,
      ipAddress,
    });

    return updated;
  }

  async addCheckpoint(questId: string, dto: CreateCheckpointDto, actorUserId: string, ipAddress?: string) {
    const quest = await this.prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) throw new NotFoundException('Квест не найден');

    const checkpoint = await this.prisma.questCheckpoint.create({
      data: {
        questId,
        title: dto.title,
        description: dto.description,
        points: dto.points,
        order: dto.order ?? 0,
        code: generateRandomCode(1, 6),
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'quest.checkpoint.create',
      targetType: 'QuestCheckpoint',
      targetId: checkpoint.id,
      metadata: { questId, title: checkpoint.title },
      ipAddress,
    });

    return checkpoint;
  }

  async regenerateCheckpointCode(questId: string, checkpointId: string, actorUserId: string, ipAddress?: string) {
    const checkpoint = await this.prisma.questCheckpoint.findUnique({ where: { id: checkpointId } });
    if (!checkpoint || checkpoint.questId !== questId) {
      throw new NotFoundException('Чекпоинт не найден');
    }

    const updated = await this.prisma.questCheckpoint.update({
      where: { id: checkpointId },
      data: { code: generateRandomCode(1, 6) },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'quest.checkpoint.regenerate-code',
      targetType: 'QuestCheckpoint',
      targetId: checkpointId,
      ipAddress,
    });

    return updated;
  }
}
