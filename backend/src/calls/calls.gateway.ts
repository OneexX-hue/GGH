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

interface JoinCallRoomPayload {
  callRoomId: string;
  kind: 'audio' | 'video';
}

interface LeaveCallRoomPayload {
  callRoomId: string;
}

// Групповые звонки (блок I) — mesh без SFU, поэтому лимит участников
// небольшой: N участников означают N*(N-1)/2 прямых P2P-соединений
// (полный граф), при 4 участниках это уже 6 соединений на клиента —
// разумный потолок без выделенного медиасервера. См. docs/DECISIONS.md.
const MAX_CALL_ROOM_SIZE = 4;

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
  // Групповые звонки (блок I) — callRoomId -> участники; отдельно от
  // activeCalls (та структура — только для 1:1 истории). Не пишутся в
  // Call-историю — вне объёма этого прохода, см. docs/DECISIONS.md.
  private readonly callRooms = new Map<string, Set<string>>();
  // Обратный индекс для очистки при disconnect — в каких комнатах
  // состоит пользователь.
  private readonly userCallRooms = new Map<string, Set<string>>();

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
      const rooms = this.userCallRooms.get(client.userId);
      if (rooms) {
        for (const callRoomId of [...rooms]) void this.leaveCallRoom(client.userId, callRoomId);
      }
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
   * Групповой звонок (mesh, до MAX_CALL_ROOM_SIZE участников). Клиент
   * сам решает, с кем из уже присутствующих участников устанавливать
   * P2P-соединение — сервер только держит список участников комнаты и
   * рассылает join/leave-уведомления, offer/answer/ice-candidate
   * переиспользуются как есть (те же события, что и в 1:1, просто
   * callId здесь равен callRoomId, а `to` указывает на конкретного
   * участника mesh-сетки).
   */
  @SubscribeMessage('join-call-room')
  async onJoinCallRoom(client: AuthenticatedSocket, payload: JoinCallRoomPayload) {
    if (!client.userId) return;
    const room = this.callRooms.get(payload.callRoomId) ?? new Set<string>();

    if (room.size >= MAX_CALL_ROOM_SIZE) {
      this.sendLocal(client.userId, 'call-room-full', { callRoomId: payload.callRoomId });
      return;
    }

    const existingPeers = [...room];
    room.add(client.userId);
    this.callRooms.set(payload.callRoomId, room);
    if (!this.userCallRooms.has(client.userId)) this.userCallRooms.set(client.userId, new Set());
    this.userCallRooms.get(client.userId)!.add(payload.callRoomId);

    for (const peerId of existingPeers) {
      await this.relay(peerId, 'peer-joined', { callRoomId: payload.callRoomId, peerId: client.userId, kind: payload.kind });
    }
    // Отвечаем самому присоединившемуся списком тех, кто уже в комнате —
    // он сам инициирует offer к каждому из них (см. calls-context на клиенте).
    this.sendLocal(client.userId, 'room-peers', { callRoomId: payload.callRoomId, peers: existingPeers });
  }

  @SubscribeMessage('leave-call-room')
  async onLeaveCallRoom(client: AuthenticatedSocket, payload: LeaveCallRoomPayload) {
    if (!client.userId) return;
    await this.leaveCallRoom(client.userId, payload.callRoomId);
  }

  private async leaveCallRoom(userId: string, callRoomId: string): Promise<void> {
    const room = this.callRooms.get(callRoomId);
    if (!room || !room.has(userId)) return;

    room.delete(userId);
    this.userCallRooms.get(userId)?.delete(callRoomId);
    if (room.size === 0) this.callRooms.delete(callRoomId);

    for (const peerId of room) {
      await this.relay(peerId, 'peer-left', { callRoomId, peerId: userId });
    }
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
