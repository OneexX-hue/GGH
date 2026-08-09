import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async create(dto: CreateRoleDto, actorUserId: string, ipAddress?: string) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Роль с таким именем уже существует');
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        isSystem: false, // системные роли (owner/super_admin/member) создаются только сидом
      },
    });

    if (dto.permissionKeys?.length) {
      const permissions = await this.prisma.permission.findMany({
        where: { key: { in: dto.permissionKeys } },
      });
      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }

    await this.auditLog.record({
      actorUserId,
      action: 'role.create',
      targetType: 'Role',
      targetId: role.id,
      metadata: { name: role.name },
      ipAddress,
    });

    return role;
  }

  async assign(roleId: string, userId: string, actorUserId: string, ipAddress?: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Роль не найдена');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'role.assign',
      targetType: 'User',
      targetId: userId,
      metadata: { roleName: role.name },
      ipAddress,
    });

    return { userId, roleId };
  }

  async unassign(roleId: string, userId: string, actorUserId: string, ipAddress?: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Роль не найдена');

    if (role.name === 'owner') {
      const ownerCount = await this.prisma.userRole.count({ where: { roleId } });
      if (ownerCount <= 1) {
        throw new BadRequestException('Нельзя снять роль Owner с последнего владельца клуба');
      }
    }

    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });

    await this.auditLog.record({
      actorUserId,
      action: 'role.unassign',
      targetType: 'User',
      targetId: userId,
      metadata: { roleName: role.name },
      ipAddress,
    });

    return { userId, roleId };
  }
}
