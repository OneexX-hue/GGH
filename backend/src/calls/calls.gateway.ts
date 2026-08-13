import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { CallKind, CallStatus } from '@prisma/client';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { CallsHistoryService } from './calls-history.service';

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
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CallsGateway.name);
  // In-memory presence на один backend-инстанс — см. явное ограничение
  // в docs/DECISIONS.md (не масштабируется на несколько инстансов без
  // общего presence-стора).
  private readonly online = new Map<string, AuthenticatedSocket>();
  // История звонков (блок G) — не для сигнализации, только для записи
  // завершённых/пропущенных/отклонённых звонков в БД, см. Call в schema.prisma.
  private readonly activeCalls = new Map<string, ActiveCall>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly callsHistory: CallsHistoryService,
  ) {}

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
      this.logger.log(`Пользователь ${payload.sub} подключился к сигнализации звонков`);
    } catch {
      client.close(4401, 'Недействительный токен');
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId && this.online.get(client.userId) === client) {
      this.online.delete(client.userId);
      this.logger.log(`Пользователь ${client.userId} отключился от сигнализации звонков`);
    }
  }

  private send(userId: string, event: string, data: Record<string, unknown>): boolean {
    const socket = this.online.get(userId);
    if (!socket) return false;
    socket.send(JSON.stringify({ event, data }));
    return true;
  }

  @SubscribeMessage('call-user')
  onCallUser(client: AuthenticatedSocket, payload: CallUserPayload) {
    if (!client.userId) return;
    const startedAt = new Date();
    const delivered = this.send(payload.to, 'incoming-call', {
      from: client.userId,
      callId: payload.callId,
      kind: payload.kind,
    });
    if (!delivered) {
      this.send(client.userId, 'call-failed', { callId: payload.callId, reason: 'user-offline' });
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
  onAcceptCall(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    this.send(payload.to, 'call-accepted', { from: client.userId, callId: payload.callId });
    const active = this.activeCalls.get(payload.callId);
    if (active) active.acceptedAt = new Date();
  }

  @SubscribeMessage('reject-call')
  onRejectCall(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    this.send(payload.to, 'call-rejected', { from: client.userId, callId: payload.callId });
    this.finalizeCall(payload.callId, CallStatus.REJECTED);
  }

  @SubscribeMessage('offer')
  onOffer(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    this.send(payload.to, 'offer', { from: client.userId, callId: payload.callId, sdp: payload.sdp });
  }

  @SubscribeMessage('answer')
  onAnswer(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    this.send(payload.to, 'answer', { from: client.userId, callId: payload.callId, sdp: payload.sdp });
  }

  @SubscribeMessage('ice-candidate')
  onIceCandidate(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    this.send(payload.to, 'ice-candidate', {
      from: client.userId,
      callId: payload.callId,
      candidate: payload.candidate,
    });
  }

  @SubscribeMessage('end-call')
  onEndCall(client: AuthenticatedSocket, payload: RelayToPayload) {
    if (!client.userId) return;
    this.send(payload.to, 'call-ended', { from: client.userId, callId: payload.callId });
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
