import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
   * статистике участника (ТЗ гл. 3.6 — единая сводная статистика).
   * Модуль обязан быть включён в реестре, иначе событие отклоняется.
   */
  async applyStatEvent(event: ModuleStatEvent) {
    const moduleDef = await this.prisma.moduleDefinition.findUnique({ where: { key: event.moduleKey } });
    if (!moduleDef || !moduleDef.isEnabled) {
      throw new NotFoundException(`Модуль "${event.moduleKey}" не найден или выключен`);
    }

    return this.prisma.user.update({
      where: { id: event.userId },
      data: { pointsTotal: { increment: event.points } },
    });
  }
}
