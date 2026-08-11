import { PrismaClient, InviteType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CORE_PERMISSIONS = [
  'invites.create',
  'invites.revoke',
  'applications.review',
  'users.manage',
  'roles.manage',
  'modules.manage',
  'chat.moderate',
  'audit.read',
];

const CORE_ROLES: Array<{ name: string; isSystem: boolean; permissions: string[] }> = [
  { name: 'owner', isSystem: true, permissions: CORE_PERMISSIONS },
  {
    name: 'super_admin',
    isSystem: true,
    permissions: CORE_PERMISSIONS.filter((p) => p !== 'roles.manage'),
  },
  {
    name: 'event_admin',
    isSystem: false,
    permissions: ['modules.manage', 'applications.review'],
  },
  { name: 'chat_moderator', isSystem: false, permissions: ['chat.moderate'] },
  { name: 'member', isSystem: true, permissions: [] },
  { name: 'guest', isSystem: false, permissions: [] },
];

async function main() {
  for (const key of CORE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  for (const roleDef of CORE_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { isSystem: roleDef.isSystem },
      create: { name: roleDef.name, isSystem: roleDef.isSystem },
    });

    for (const permKey of roleDef.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // Тестовый Owner-аккаунт — только для локальной разработки, не для прод-окружения.
  const ownerPasswordHash = await bcrypt.hash('TEST-owner-password-123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'test-owner@carclub.local' },
    update: {},
    create: {
      email: 'test-owner@carclub.local',
      passwordHash: ownerPasswordHash,
      displayName: 'TEST Owner',
      status: 'ACTIVE',
    },
  });

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'owner' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: owner.id, roleId: ownerRole.id },
  });

  await prisma.invite.upsert({
    where: { code: 'TEST-INVITE-0001' },
    update: {},
    create: {
      code: 'TEST-INVITE-0001',
      type: InviteType.MULTI_USE,
      maxUses: 10,
      createdByUserId: owner.id,
    },
  });

  // Реестр игрового модуля "авто-квест" (Этап 2) — выключен по умолчанию,
  // включение остаётся осознанным admin-действием через web-admin /modules.
  await prisma.moduleDefinition.upsert({
    where: { key: 'auto-quest' },
    update: {},
    create: {
      key: 'auto-quest',
      name: 'Авто-квест',
      description: 'Прохождение чекпоинтов по секретным кодам, баллы за прохождение',
      isEnabled: false,
    },
  });

  // Реестр игрового модуля "прятки" (Этап 2) — тоже выключен по умолчанию.
  await prisma.moduleDefinition.upsert({
    where: { key: 'hide-and-seek' },
    update: {},
    create: {
      key: 'hide-and-seek',
      name: 'Прятки',
      description: 'Один участник прячется и лично называет код найденному, баллы за находку',
      isEnabled: false,
    },
  });

  console.log('Seed complete. Test owner: test-owner@carclub.local / TEST-owner-password-123');
  console.log('Test invite code: TEST-INVITE-0001');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
