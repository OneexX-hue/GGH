// STUN/TURN конфигурация для RTCPeerConnection. По умолчанию — публичный
// Google STUN (достаточно для прямого P2P в одной сети/при не слишком
// строгом NAT). TURN (self-hosted coturn, см. infra/docker-compose.yml
// и docs/DECISIONS.md, "WebRTC-звонки — архитектура") подключается через
// переменные окружения, если заданы — не хардкодим адрес конкретного
// облачного провайдера.
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}
