import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Invite, InviteType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateInviteDto } from './dto/create-invite.dto';

function generateInviteCode(): string {
  // Не Base64 (избегаем визуально похожих символов 0/O, 1/l при ручной передаче кода)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5, 10)}`;
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(creatorUserId: string, dto: CreateInviteDto, ipAddress?: string) {
    if (dto.type === InviteType.MULTI_USE && !dto.maxUses) {
      throw new BadRequestException('maxUses обязателен для MULTI_USE инвайта');
    }
    if (dto.type === InviteType.PERSONAL && !dto.personalContact) {
      throw new BadRequestException('personalContact обязателен для PERSONAL инвайта');
    }

    let code = generateInviteCode();
    // Крайне маловероятная коллизия — на всякий случай перегенерировать один раз.
    const existing = await this.prisma.invite.findUnique({ where: { code } });
    if (existing) {
      code = generateInviteCode();
    }

    const invite = await this.prisma.invite.create({
      data: {
        code,
        type: dto.type,
        maxUses: dto.type === InviteType.MULTI_USE ? dto.maxUses : null,
        personalContact: dto.type === InviteType.PERSONAL ? dto.personalContact : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdByUserId: creatorUserId,
      },
    });

    await this.auditLog.record({
      actorUserId: creatorUserId,
      action: 'invite.create',
      targetType: 'Invite',
      targetId: invite.id,
      metadata: { code: invite.code, type: invite.type },
      ipAddress,
    });

    return invite;
  }

  async revoke(id: string, actorUserId: string, ipAddress?: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id } });
    if (!invite) {
      throw new NotFoundException('Инвайт не найден');
    }

    const updated = await this.prisma.invite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'invite.revoke',
      targetType: 'Invite',
      targetId: id,
      ipAddress,
    });

    return updated;
  }

  async list() {
    return this.prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
  }

  private inviteUsageLimit(invite: Invite): number {
    if (invite.type === InviteType.SINGLE_USE || invite.type === InviteType.PERSONAL) {
      return 1;
    }
    return invite.maxUses ?? Number.MAX_SAFE_INTEGER;
  }

  /**
   * Атомарно проверяет и резервирует один "слот" инвайта (increment usesCount
   * только если лимит ещё не достигнут — предотвращает гонку при
   * одновременном использовании multi-use инвайта несколькими людьми).
   * Должен вызываться внутри той же транзакции, где создаётся User.
   */
  async reserveWithinTransaction(
    tx: Prisma.TransactionClient,
    code: string,
    contact: string,
  ): Promise<Invite> {
    const invite = await tx.invite.findUnique({ where: { code } });
    if (!invite) {
      throw new NotFoundException('Инвайт-код не найден');
    }
    if (invite.revokedAt) {
      throw new BadRequestException('Инвайт-код отозван');
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Срок действия инвайт-кода истёк');
    }
    if (invite.type === InviteType.PERSONAL && invite.personalContact !== contact) {
      throw new BadRequestException('Этот инвайт-код персональный и не привязан к вашему email/телефону');
    }

    const limit = this.inviteUsageLimit(invite);
    const result = await tx.invite.updateMany({
      where: { id: invite.id, usesCount: { lt: limit } },
      data: { usesCount: { increment: 1 } },
    });

    if (result.count === 0) {
      throw new ConflictException('Инвайт-код уже использован максимальное число раз');
    }

    return invite;
  }
}
