import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, InviteType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateApplicationDto } from './dto/create-application.dto';

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5, 10)}`;
}

// Заявки на вступление без инвайт-кода (ТЗ гл. 2.1) — требуют модерации
// администратором перед выдачей доступа.
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async submit(dto: CreateApplicationDto) {
    return this.prisma.membershipApplication.create({
      data: {
        applicantName: dto.applicantName,
        contact: dto.contact,
        inviteId: dto.inviteId,
      },
    });
  }

  async list(status?: ApplicationStatus) {
    return this.prisma.membershipApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(
    id: string,
    actorUserId: string,
    decision: 'APPROVED' | 'REJECTED',
    ipAddress?: string,
  ) {
    const application = await this.prisma.membershipApplication.findUnique({ where: { id } });
    if (!application) {
      throw new NotFoundException('Заявка не найдена');
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Заявка уже рассмотрена');
    }

    const updated = await this.prisma.membershipApplication.update({
      where: { id },
      data: {
        status: decision === 'APPROVED' ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });

    let issuedInviteCode: string | undefined;
    if (decision === 'APPROVED') {
      const invite = await this.prisma.invite.create({
        data: {
          code: generateInviteCode(),
          type: InviteType.PERSONAL,
          personalContact: application.contact,
          createdByUserId: actorUserId,
        },
      });
      issuedInviteCode = invite.code;
    }

    await this.auditLog.record({
      actorUserId,
      action: `application.${decision.toLowerCase()}`,
      targetType: 'MembershipApplication',
      targetId: id,
      metadata: issuedInviteCode ? { issuedInviteCode } : undefined,
      ipAddress,
    });

    return { application: updated, issuedInviteCode };
  }
}
