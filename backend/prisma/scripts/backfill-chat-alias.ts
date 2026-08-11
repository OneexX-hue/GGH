// Разовый скрипт: у пользователей, заведённых до появления
// User.chatAlias (docs/DECISIONS.md "Псевдонимная личность в чате"),
// генерирует псевдоним и обновляет имя профиля в Rocket.Chat (если
// пользователь туда уже заведён). Запуск: npx ts-node prisma/scripts/backfill-chat-alias.ts
import { PrismaClient } from '@prisma/client';
import { generateChatAlias } from '../../src/common/utils/alias.util';

const prisma = new PrismaClient();

async function updateRocketChatName(rocketChatUserId: string, alias: string): Promise<void> {
  const baseUrl = process.env.ROCKETCHAT_BASE_URL;
  const adminToken = process.env.ROCKETCHAT_ADMIN_TOKEN;
  const adminUserId = process.env.ROCKETCHAT_ADMIN_USER_ID;
  if (!baseUrl || !adminToken || !adminUserId) return;

  try {
    const response = await fetch(`${baseUrl}/api/v1/users.update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': adminToken,
        'X-User-Id': adminUserId,
      },
      body: JSON.stringify({ userId: rocketChatUserId, data: { name: alias } }),
    });
    if (!response.ok) {
      console.warn(`Rocket.Chat users.update вернул ${response.status} для ${rocketChatUserId}`);
    }
  } catch (error) {
    console.warn(`Не удалось обновить имя в Rocket.Chat для ${rocketChatUserId}: ${(error as Error).message}`);
  }
}

async function main() {
  const users = await prisma.user.findMany({ where: { chatAlias: null } });
  console.log(`Пользователей без chatAlias: ${users.length}`);

  for (const user of users) {
    let alias = generateChatAlias();
    for (let attempt = 0; attempt < 5 && (await prisma.user.findUnique({ where: { chatAlias: alias } })); attempt += 1) {
      alias = generateChatAlias();
    }

    await prisma.user.update({ where: { id: user.id }, data: { chatAlias: alias } });
    console.log(`${user.id} -> ${alias}`);

    if (user.rocketChatUserId) {
      await updateRocketChatName(user.rocketChatUserId, alias);
    }
  }

  console.log('Готово.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
