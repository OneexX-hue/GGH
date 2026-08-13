import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { CallKind, CallStatus } from '@prisma/client';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { CallsHistoryService } from './calls-history.service';
import { CallsPresenceService } from './calls-presence.service';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
}

interface CallUserPayload {
  to: string;
  callId: string;
  kind: 'audio' | 'video';
}

interface RelayToPayload {
  to: string;
  callId: string;
  sdp?: unknown;
  candidate?: unknown;
}

interface ActiveCall {
  callerId: string;
  calleeId: string;
  kind: CallKind;
  startedAt: Date;
  acceptedAt?: Date;
}

// Сигнальный шлюз WebRTC-звонков — только пересылает offer/answer/ICE
// между двумя авторизованными участниками, никогда не видит и не
// обрабатывает сам медиапоток (см. docs/DECISIONS.md, "WebRTC-звонки —
// архитектура"). Обычный `ws`, не socket.io — сигнализация состоит из
// пары сообщений на звонок, отдельный клиентский SDK не нужен.
@WebSocketGateway({ path: '/calls' })
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(CallsGateway.name);
  // Presence НА ЭТОМ инстансе — сокет физически нельзя передать между
  // процессами. Кросс-инстансная часть — CallsPresenceService (Valkey),
  // см. docs/DECISIONS.md, "Масштабирование на несколько инстансов".
  private readonly online = new Map<string, AuthenticatedSocket>();
  // История звонков (блок G) — не для сигнализации, только для записи
  // завершённых/пропущенных/отклонённых звонков в БД, см. Call в schema.prisma.
  private readonly activeCalls = new Map<string, ActiveCall>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly callsHistory: CallsHistoryService,
    private readonly presence: CallsPresenceService,
  ) {}

  onModuleInit(): void {
    // Другой инстанс не смог доставить локально — проверяем, есть ли
    // получатель у НАС, и если да, реально отправляем в сокет.
    this.presence.setOnRelayMessage(({ targetUserId, event, data }) => {
      this.sendLocal(targetUserId, event, data as Record<string, unknown>);
    });
  }

  handleConnection(client: AuthenticatedSocket, request: IncomingMessage) {
    const url = new URL(request.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) {
      this.logger.warn('WS-подключение без токена — закрываю');
      client.close(4401, 'Требуется токен');
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET', 'dev-insecure-secret-change-me'),
      });
      if (payload.type === 'refresh') {
        throw new Error('refresh-токен нельзя использовать для WS');
      }
      client.userId = payload.sub;
      this.online.set(payload.sub, client);
      void this.presence.markOnline(payload.sub);
      this.logger.log(`Пользователь ${payload.sub} подключился к сигнализации звонков`);
    } catch {
      client.close(4401, 'Недействительный токен');
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId && this.online.get(client.userId) === client) {
      this.online.delete(client.userId);
      void this.presence.markOffline(client.userId);
      this.logger.log(`Пользователь ${client.userId} отключился от сигнализации звонков`);
    }
  }

  private sendLocal(userId: string, event: string, data: Record<string, unknown>): boolean {
    const socket = this.online.get(userId);
    if (!socket) return false;
    socket.send(JSON.stringify({ event, data }));
    return true;
  }

  /**
   * Доставка получателю независимо от того, на каком backend-инстансе
   * он подключён. Локальная доставка — быстрый путь (без похода в
   * Valkey). Если получателя нет локально, но он есть в общем
   * presence-наборе `calls:online` — публикуем в общий канал relay,
   * инстанс, у которого он реально подключён, доставит. Возвращает
   * false только если получателя нет вообще нигде (или Valkey не
   * настроен и получателя нет локально — тогда как раньше, single-instance).
   */
  private async relay(userId: string, event: string, data: Record<string, unknown>): Promise<boolean> {
    if (this.sendLocal(userId, event, data)) return true;
    if (!this.presence.enabled) return false;
    if (!(await this.presence.isOnlineAnywhere(userId))) return false;
    await this.presence.publishRelay({ targetUserId: userId, event, data });
    return true;
  }

  @SubscribeMessage('call-user')
  async onCallUser(client: AuthenticatedSocket, payload: CallUserPayload) {
    if (!client.userId) return;
    const startedAt = new Date();
    const delivered = await this.relay(payload.to, 'incoming-call', {
      from: client.userId,
      callId: payload.callId,
      kind: payload.kind,
    });
    if (!delivered) {
      this.sendLocal(client.userId, 'call-failed', { callId: payload.callId, reason: 'user-offline' });
      void this.callsHistory.record({
        callerId: client.userId,
        calleeId: payload.to,
        kind: payload.kind === 'video' ? CallKind.VIDEO : CallKind.AUDIO,
        status: CallStatus.FAILED,
        startedAt,
        endedAt: startedAt,
      });
      return;
    }
    this.activeCalls.set(payload.callId, {
      callerId: client.userId,
      calleeId: payload.to,
      kind: payload.kind === 'video' ? CallKind.VIDEO : CallKind.AUDIO,
      startedAt,
    });
  }

  @SubscribeMessage('accept-call')
  async onAcceptCall(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    await this.relay(payload.to, 'call-accepted', { from: client.userId, callId: payload.callId });
    const active = this.activeCalls.get(payload.callId);
    if (active) active.acceptedAt = new Date();
  }

  @SubscribeMessage('reject-call')
  async onRejectCall(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    await this.relay(payload.to, 'call-rejected', { from: client.userId, callId: payload.callId });
    this.finalizeCall(payload.callId, CallStatus.REJECTED);
  }

  @SubscribeMessage('offer')
  async onOffer(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    await this.relay(payload.to, 'offer', { from: client.userId, callId: payload.callId, sdp: payload.sdp });
  }

  @SubscribeMessage('answer')
  async onAnswer(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    await this.relay(payload.to, 'answer', { from: client.userId, callId: payload.callId, sdp: payload.sdp });
  }

  @SubscribeMessage('ice-candidate')
  async onIceCandidate(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    await this.relay(payload.to, 'ice-candidate', {
      from: client.userId,
      callId: payload.callId,
      candidate: payload.candidate,
    });
  }

  @SubscribeMessage('end-call')
  async onEndCall(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    await this.relay(payload.to, 'call-ended', { from: client.userId, callId: payload.callId });
    const active = this.activeCalls.get(payload.callId);
    this.finalizeCall(payload.callId, active?.acceptedAt ? CallStatus.COMPLETED : CallStatus.MISSED);
  }

  /**
   * Записывает завершённый/пропущенный/отклонённый звонок в историю
   * (блок G) и убирает его из activeCalls. Best-effort: сбой записи
   * истории не должен ронять сам сигнальный флоу (звонок уже завершён
   * для участников независимо от того, сохранилась ли история).
   */
  private finalizeCall(callId: string, status: CallStatus): void {
    const active = this.activeCalls.get(callId);
    if (!active) return;
    this.activeCalls.delete(callId);

    const endedAt = new Date();
    this.callsHistory
      .record({
        callerId: active.callerId,
        calleeId: active.calleeId,
        kind: active.kind,
        status,
        startedAt: active.startedAt,
        endedAt,
      })
      .catch((error) => this.logger.warn(`Не удалось записать историю звонка ${callId}: ${(error as Error).message}`));
  }
}
