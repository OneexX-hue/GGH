import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  status: true,
  pointsTotal: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async list(params: { skip?: number; take?: number }) {
    return this.prisma.user.findMany({
      skip: params.skip ?? 0,
      take: params.take ?? 50,
      orderBy: { createdAt: 'desc' },
      select: { ...PUBLIC_USER_SELECT, email: true, phone: true },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PUBLIC_USER_SELECT,
    });
  }

  async ban(targetUserId: string, actorUserId: string, ipAddress?: string) {
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'BANNED' },
      select: PUBLIC_USER_SELECT,
    });

    await this.auditLog.record({
      actorUserId,
      action: 'user.ban',
      targetType: 'User',
      targetId: targetUserId,
      ipAddress,
    });

    return user;
  }

  async addVehicle(userId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: { ownerUserId: userId, ...dto },
    });
  }

  async listVehicles(userId: string) {
    return this.prisma.vehicle.findMany({ where: { ownerUserId: userId } });
  }
}
