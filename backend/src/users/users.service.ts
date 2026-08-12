import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';
import { rocketChatUsernameFor } from '../chat-bridge/rocketchat-username.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  status: true,
  pointsTotal: true,
  twoFactorEnabled: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly chatBridge: ChatBridgeService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async registerPushToken(userId: string, token: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { pushToken: token } });
    return { success: true };
  }

  async list(params: { skip?: number; take?: number }) {
    return this.prisma.user.findMany({
      skip: params.skip ?? 0,
      take: params.take ?? 50,
      orderBy: { createdAt: 'desc' },
      select: { ...PUBLIC_USER_SELECT, email: true, phone: true },
    });
  }

  /**
   * Лёгкий справочник участников для старта чата (мобильное приложение) —
   * доступен любому авторизованному участнику, не только админам, в
   * отличие от list(). rocketChatUsername вычисляется детерминированно
   * (см. chat-bridge/rocketchat-username.util) — не требует отдельного
   * похода в Rocket.Chat.
   */
  async directory() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, avatarUrl: true },
    });

    return users.map((u) => ({ ...u, rocketChatUsername: rocketChatUsernameFor(u.id) }));
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
      select: { ...PUBLIC_USER_SELECT, rocketChatUserId: true },
    });

    if (user.rocketChatUserId) {
      await this.chatBridge.setUserActive(user.rocketChatUserId, false);
    }

    await this.auditLog.record({
      actorUserId,
      action: 'user.ban',
      targetType: 'User',
      targetId: targetUserId,
      ipAddress,
    });

    const { rocketChatUserId: _rocketChatUserId, ...publicUser } = user;
    return publicUser;
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
