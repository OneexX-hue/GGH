import type { RCMessage, RCRoom, RCSubscription, RoomType, RocketChatSession } from './types';

export class RocketChatApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const HISTORY_ENDPOINT: Record<RoomType, string> = {
  d: 'im.history',
  p: 'groups.history',
  c: 'channels.history',
};

// Тонкий REST-клиент Rocket.Chat, написанный вручную поверх задокументированного
// API (см. docs/DECISIONS.md — "Rocket.Chat клиентская интеграция"): не тянем
// @rocket.chat/sdk (заброшен на npm, риск несовместимости с React Native).
export class RocketChatRestClient {
  constructor(private readonly session: RocketChatSession) {}

  private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetch(`${this.session.baseUrl}/api/v1/${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.session.authToken,
        'X-User-Id': this.session.rocketChatUserId,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: response.statusText }));
      throw new RocketChatApiError(response.status, body.error ?? 'Ошибка запроса к Rocket.Chat');
    }

    return response.json() as Promise<T>;
  }

  async listSubscriptions(): Promise<RCSubscription[]> {
    const result = await this.request<{ update: RCSubscription[] }>('subscriptions.get');
    return result.update;
  }

  async createDirectMessage(username: string): Promise<RCRoom> {
    const result = await this.request<{ room: RCRoom }>('im.create', {
      method: 'POST',
      body: { username },
    });
    return result.room;
  }

  async createGroup(name: string, members: string[]): Promise<RCRoom> {
    const result = await this.request<{ group: RCRoom }>('groups.create', {
      method: 'POST',
      body: { name, members },
    });
    return result.group;
  }

  async createChannel(name: string, members: string[], broadcast: boolean): Promise<RCRoom> {
    const result = await this.request<{ channel: RCRoom }>('channels.create', {
      method: 'POST',
      body: { name, members, readOnly: broadcast, extraData: { broadcast } },
    });
    return result.channel;
  }

  async getHistory(roomType: RoomType, roomId: string, count = 50): Promise<RCMessage[]> {
    const endpoint = HISTORY_ENDPOINT[roomType];
    const result = await this.request<{ messages: RCMessage[] }>(
      `${endpoint}?roomId=${encodeURIComponent(roomId)}&count=${count}`,
    );
    return result.messages;
  }

  async postMessage(roomId: string, text: string): Promise<RCMessage> {
    const result = await this.request<{ message: RCMessage }>('chat.postMessage', {
      method: 'POST',
      body: { roomId, text },
    });
    return result.message;
  }
}
