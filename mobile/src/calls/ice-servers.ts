// STUN/TURN конфигурация — см. web-admin/lib/calls/ice-servers.ts
// (тот же принцип: публичный Google STUN по умолчанию, self-hosted
// coturn через переменные окружения, см. docs/DECISIONS.md).
export function getIceServers() {
  const servers: { urls: string; username?: string; credential?: string }[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.EXPO_PUBLIC_TURN_USERNAME,
      credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}
