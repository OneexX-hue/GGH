const USERNAME_PREFIX = 'carclub_';

// Детерминированный RC-username из нашего userId — мобильный клиент и
// справочник участников (`GET /users/directory`) могут вычислить его сами,
// не запрашивая Rocket.Chat напрямую.
export function rocketChatUsernameFor(userId: string): string {
  return `${USERNAME_PREFIX}${userId.slice(0, 8)}`;
}

// Обратное преобразование — по RC-username вернуть первые 8 символов
// нашего userId (не полный id, т.к. username усечён по построению).
// Используется как префикс для Prisma-поиска (User.id startsWith).
// null, если строка не похожа на username, построенный этой функцией.
export function userIdPrefixFromRcUsername(username: string): string | null {
  if (!username.startsWith(USERNAME_PREFIX)) return null;
  const prefix = username.slice(USERNAME_PREFIX.length);
  return prefix.length === 8 ? prefix : null;
}
