import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { generateRandomCode } from '../../common/utils/random-code.util';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundDto } from './dto/update-round.dto';

// Админ-CRUD раундов «Прятки» (право modules.manage, см. rounds.controller.ts).
// Начисление баллов участникам — не здесь, см. round-participation.service.ts.
@Injectable()
export class RoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list() {
    return this.prisma.hideAndSeekRound.findMany({
      orderBy: { createdAt: 'desc' },
      include: { hider: { select: { id: true, displayName: true } }, _count: { select: { finds: true } } },
    });
  }

  async getDetail(id: string) {
    const round = await this.prisma.hideAndSeekRound.findUnique({
      where: { id },
      include: {
        hider: { select: { id: true, displayName: true } },
        finds: { orderBy: { foundAt: 'asc' }, include: { seeker: { select: { id: true, displayName: true } } } },
      },
    });
    if (!round) throw new NotFoundException('Раунд не найден');
    return round;
  }

  async create(dto: CreateRoundDto, actorUserId: string, ipAddress?: string) {
    const hider = await this.prisma.user.findUnique({ where: { id: dto.hiderUserId } });
    if (!hider) throw new NotFoundException('Прячущийся участник не найден');

    const round = await this.prisma.hideAndSeekRound.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        hiderUserId: dto.hiderUserId,
        points: dto.points,
        code: generateRandomCode(1, 6),
        createdByUserId: actorUserId,
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'hide-and-seek.round.create',
      targetType: 'HideAndSeekRound',
      targetId: round.id,
      metadata: { title: round.title, hiderUserId: round.hiderUserId },
      ipAddress,
    });

    return round;
  }

  async update(id: string, dto: UpdateRoundDto, actorUserId: string, ipAddress?: string) {
    const existing = await this.prisma.hideAndSeekRound.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Раунд не найден');

    if (dto.hiderUserId) {
      const hider = await this.prisma.user.findUnique({ where: { id: dto.hiderUserId } });
      if (!hider) throw new NotFoundException('Прячущийся участник не найден');
    }

    const updated = await this.prisma.hideAndSeekRound.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isActive: dto.isActive,
        hiderUserId: dto.hiderUserId,
        points: dto.points,
      },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'hide-and-seek.round.update',
      targetType: 'HideAndSeekRound',
      targetId: id,
      ipAddress,
    });

    return updated;
  }

  async regenerateCode(id: string, actorUserId: string, ipAddress?: string) {
    const existing = await this.prisma.hideAndSeekRound.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Раунд не найден');

    const updated = await this.prisma.hideAndSeekRound.update({
      where: { id },
      data: { code: generateRandomCode(1, 6) },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'hide-and-seek.round.regenerate-code',
      targetType: 'HideAndSeekRound',
      targetId: id,
      ipAddress,
    });

    return updated;
  }
}
