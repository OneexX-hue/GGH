import { RocketChatRestClient, RocketChatApiError } from './rest-client';
import type { RocketChatSession } from './types';

const session: RocketChatSession = {
  baseUrl: 'http://rc.local',
  wsUrl: 'ws://rc.local',
  rocketChatUserId: 'rc-user-1',
  authToken: 'rc-auth-token',
};

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  }) as unknown as typeof fetch;
}

describe('RocketChatRestClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('отправляет X-Auth-Token и X-User-Id из сессии на каждый запрос', async () => {
    mockFetchOnce({ json: async () => ({ update: [] }) });
    const client = new RocketChatRestClient(session);

    await client.listSubscriptions();

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://rc.local/api/v1/subscriptions.get');
    expect(init.headers['X-Auth-Token']).toBe('rc-auth-token');
    expect(init.headers['X-User-Id']).toBe('rc-user-1');
  });

  it('listSubscriptions возвращает поле update из ответа', async () => {
    const subs = [{ _id: 's1', rid: 'room1', t: 'c', unread: 2, alert: true, _updatedAt: '2026-08-12' }];
    mockFetchOnce({ json: async () => ({ update: subs }) });
    const client = new RocketChatRestClient(session);

    await expect(client.listSubscriptions()).resolves.toEqual(subs);
  });

  it('getHistory выбирает правильный endpoint по типу комнаты', async () => {
    mockFetchOnce({ json: async () => ({ messages: [] }) });
    const client = new RocketChatRestClient(session);

    await client.getHistory('d', 'room1');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/im.history?');

    await client.getHistory('p', 'room2');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/groups.history?');

    await client.getHistory('c', 'room3');
    expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain('/channels.history?');
  });

  it('postMessage отправляет roomId и text методом POST', async () => {
    mockFetchOnce({ json: async () => ({ message: { _id: 'm1', rid: 'room1', msg: 'привет', ts: '', u: { _id: 'u1', username: 'ivan' } } }) });
    const client = new RocketChatRestClient(session);

    const result = await client.postMessage('room1', 'привет');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ roomId: 'room1', text: 'привет' });
    expect(result.msg).toBe('привет');
  });

  it('бросает RocketChatApiError при неуспешном ответе', async () => {
    mockFetchOnce({ ok: false, status: 401, json: async () => ({ error: 'Недействительный токен' }) });
    const client = new RocketChatRestClient(session);

    await expect(client.listSubscriptions()).rejects.toThrow(RocketChatApiError);
    await expect(client.listSubscriptions()).rejects.toThrow('Недействительный токен');
  });
});
