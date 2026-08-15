import type { RCMessage, RocketChatSession } from './types';

type MessageListener = (message: RCMessage) => void;

interface DDPIncoming {
  msg?: string;
  id?: string;
  collection?: string;
  fields?: { eventName?: string; args?: [RCMessage] };
  error?: { message?: string; reason?: string };
  result?: unknown;
}

const RECONNECT_DELAY_MS = 3000;

// Порт mobile/src/rocketchat/realtime-client.ts — тот же DDP-клиент
// (протокол Meteor, на котором построен Rocket.Chat realtime API), тот же
// стандартный WebSocket API (не RN-специфичный), поэтому переносится в
// браузер практически без изменений. См. docs/DECISIONS.md, "Web-admin
// чат — realtime вместо polling".
export class RocketChatRealtimeClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private connected = false;
  private loggedIn = false;
  private intentionallyClosed = false;
  private subscribedRoomIds = new Set<string>();
  private listeners = new Map<string, Set<MessageListener>>();
  private pendingCalls = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(private readonly session: RocketChatSession) {}

  async connect(): Promise<void> {
    this.intentionallyClosed = false;
    await this.openSocket();
    await this.login();
    for (const roomId of this.subscribedRoomIds) {
      this.sendSubscribe(roomId);
    }
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.loggedIn = false;
  }

  onRoomMessage(roomId: string, listener: MessageListener): () => void {
    if (!this.listeners.has(roomId)) {
      this.listeners.set(roomId, new Set());
    }
    this.listeners.get(roomId)!.add(listener);

    if (!this.subscribedRoomIds.has(roomId)) {
      this.subscribedRoomIds.add(roomId);
      if (this.connected && this.loggedIn) {
        this.sendSubscribe(roomId);
      }
    }

    return () => {
      this.listeners.get(roomId)?.delete(listener);
    };
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.session.wsUrl);
      this.ws = ws;

      const onOpen = () => {
        ws.send(JSON.stringify({ msg: 'connect', version: '1', support: ['1'] }));
      };

      const onMessage = (event: MessageEvent) => {
        let data: DDPIncoming;
        try {
          data = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (data.msg === 'connected') {
          this.connected = true;
          resolve();
          return;
        }
        if (data.msg === 'ping') {
          ws.send(JSON.stringify({ msg: 'pong' }));
          return;
        }
        if (data.msg === 'result' && data.id) {
          const pending = this.pendingCalls.get(data.id);
          if (pending) {
            this.pendingCalls.delete(data.id);
            if (data.error) {
              pending.reject(new Error(data.error.message ?? data.error.reason ?? 'DDP method error'));
            } else {
              pending.resolve(data.result);
            }
          }
          return;
        }
        if (data.msg === 'changed' && data.collection === 'stream-room-messages') {
          const roomId = data.fields?.eventName;
          const message = data.fields?.args?.[0];
          if (roomId && message) {
            this.listeners.get(roomId)?.forEach((listener) => listener(message));
          }
        }
      };

      const onClose = () => {
        this.connected = false;
        this.loggedIn = false;
        if (!this.intentionallyClosed) {
          setTimeout(() => {
            this.connect().catch(() => {
              // тихий retry — следующий onClose снова запланирует попытку
            });
          }, RECONNECT_DELAY_MS);
        }
      };

      ws.addEventListener('open', onOpen);
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', onClose);
      ws.addEventListener('error', () => reject(new Error('Не удалось открыть WebSocket-соединение')));
    });
  }

  private login(): Promise<void> {
    return this.call('login', [{ resume: this.session.authToken }]).then(() => {
      this.loggedIn = true;
    });
  }

  private sendSubscribe(roomId: string): void {
    const id = this.generateId();
    this.ws?.send(JSON.stringify({ msg: 'sub', id, name: 'stream-room-messages', params: [roomId, false] }));
  }

  private call(method: string, params: unknown[]): Promise<unknown> {
    const id = this.generateId();
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
    });
    this.ws?.send(JSON.stringify({ msg: 'method', method, id, params }));
    return promise;
  }

  private generateId(): string {
    return String(this.nextId++);
  }
}
