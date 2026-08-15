import { Injectable } from '@nestjs/common';
import { CallKind, CallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordCallInput {
  callerId: string;
  calleeId: string;
  kind: CallKind;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date;
}

@Injectable()
export class CallsHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordCallInput) {
    return this.prisma.call.create({ data: input });
  }

  async listForUser(userId: string, params: { skip?: number; take?: number } = {}) {
    return this.prisma.call.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: { startedAt: 'desc' },
      skip: params.skip ?? 0,
      take: params.take ?? 30,
      include: {
        caller: { select: { id: true, displayName: true } },
        callee: { select: { id: true, displayName: true } },
      },
    });
  }
}
