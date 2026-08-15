import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModuleStatEvent } from './module-integration.interface';

@Injectable()
export class ModulesRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list() {
    return this.prisma.moduleDefinition.findMany({ orderBy: { key: 'asc' } });
  }

  async register(dto: CreateModuleDto, actorUserId: string, ipAddress?: string) {
    const existing = await this.prisma.moduleDefinition.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Модуль с ключом "${dto.key}" уже зарегистрирован`);
    }

    const moduleDef = await this.prisma.moduleDefinition.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'module.register',
      targetType: 'ModuleDefinition',
      targetId: moduleDef.id,
      metadata: { key: moduleDef.key },
      ipAddress,
    });

    return moduleDef;
  }

  async update(key: string, dto: UpdateModuleDto, actorUserId: string, ipAddress?: string) {
    const moduleDef = await this.prisma.moduleDefinition.findUnique({ where: { key } });
    if (!moduleDef) throw new NotFoundException('Модуль не найден в реестре');

    const updated = await this.prisma.moduleDefinition.update({
      where: { key },
      data: {
        isEnabled: dto.isEnabled ?? undefined,
        config: dto.config ? (dto.config as Prisma.InputJsonValue) : undefined,
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: dto.isEnabled === undefined ? 'module.configure' : dto.isEnabled ? 'module.enable' : 'module.disable',
      targetType: 'ModuleDefinition',
      targetId: updated.id,
      metadata: { key },
      ipAddress,
    });

    return updated;
  }

  /**
   * Применяет событие начисления баллов от включённого модуля к сводной
   * статистике участника (ТЗ гл. 3.6 — единая сводная статистика) И
   * записывает его в журнал (StatEvent) — атомарно, в переданной
   * транзакции. Нужна отдельно от applyStatEvent(), потому что вызывающий
   * модуль обычно должен в этой же транзакции создать и свою запись об
   * анти-фрод-уникальности (например, "чекпоинт X погашен участником Y") —
   * иначе гонка двух одновременных запросов может проскочить мимо неё.
   */
  async applyStatEventWithinTransaction(tx: Prisma.TransactionClient, event: ModuleStatEvent) {
    const moduleDef = await tx.moduleDefinition.findUnique({ where: { key: event.moduleKey } });
    if (!moduleDef || !moduleDef.isEnabled) {
      throw new NotFoundException(`Модуль "${event.moduleKey}" не найден или выключен`);
    }

    const statEvent = await tx.statEvent.create({
      data: {
        moduleKey: event.moduleKey,
        userId: event.userId,
        points: event.points,
        reason: event.reason,
        occurredAt: event.occurredAt,
        metadata: event.metadata ? (event.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
    const user = await tx.user.update({
      where: { id: event.userId },
      data: { pointsTotal: { increment: event.points } },
    });

    return { statEvent, user };
  }

  async applyStatEvent(event: ModuleStatEvent) {
    return this.prisma.$transaction((tx) => this.applyStatEventWithinTransaction(tx, event));
  }

  /** Модуль включён? Переиспользуемая проверка для эндпоинтов самих модулей. */
  async assertEnabled(key: string) {
    const moduleDef = await this.prisma.moduleDefinition.findUnique({ where: { key } });
    if (!moduleDef || !moduleDef.isEnabled) {
      throw new ForbiddenException(`Модуль "${key}" сейчас недоступен`);
    }
    return moduleDef;
  }

  /** Топ участников по баллам, начисленным ЛЮБЫМ модулем (сводный лидерборд клуба). */
  async overallLeaderboard(limit = 20) {
    const grouped = await this.prisma.statEvent.groupBy({
      by: ['userId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g) => ({ user: byId.get(g.userId), points: g._sum.points ?? 0 }));
  }

  /** Топ участников по баллам, начисленным конкретным модулем (за всё время). */
  async leaderboard(key: string, limit = 20) {
    const grouped = await this.prisma.statEvent.groupBy({
      by: ['userId'],
      where: { moduleKey: key },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g) => ({ user: byId.get(g.userId), points: g._sum.points ?? 0 }));
  }

  /**
   * Кросс-модульная лента (ТЗ гл. 3.6): последние начисления баллов по
   * всем модулям сразу, не по одному — переиспользует уже готовый
   * человекочитаемый текст StatEvent.reason (тот же, что использовался
   * при формировании анонса в чат каждым модулем).
   */
  async recentFeed(params: { skip?: number; take?: number } = {}) {
    return this.prisma.statEvent.findMany({
      orderBy: { occurredAt: 'desc' },
      skip: params.skip ?? 0,
      take: params.take ?? 30,
      select: {
        id: true,
        moduleKey: true,
        points: true,
        reason: true,
        occurredAt: true,
        user: { select: { id: true, displayName: true } },
      },
    });
  }
}
