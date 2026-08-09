// Детерминированный RC-username из нашего userId — мобильный клиент и
// справочник участников (`GET /users/directory`) могут вычислить его сами,
// не запрашивая Rocket.Chat напрямую.
export function rocketChatUsernameFor(userId: string): string {
  return `carclub_${userId.slice(0, 8)}`;
}
