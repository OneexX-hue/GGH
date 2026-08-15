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

describe('RocketChatRestClient (mobile)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('отправляет X-Auth-Token и X-User-Id из сессии', async () => {
    mockFetchOnce({ json: async () => ({ update: [] }) });
    const client = new RocketChatRestClient(session);

    await client.listSubscriptions();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['X-Auth-Token']).toBe('rc-auth-token');
    expect(init.headers['X-User-Id']).toBe('rc-user-1');
  });

  it('createDirectMessage вызывает im.create и возвращает room', async () => {
    const room = { _id: 'room-1', t: 'd' as const };
    mockFetchOnce({ json: async () => ({ room }) });
    const client = new RocketChatRestClient(session);

    await expect(client.createDirectMessage('ivan')).resolves.toEqual(room);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://rc.local/api/v1/im.create');
    expect(JSON.parse(init.body)).toEqual({ username: 'ivan' });
  });

  it('createChannel передаёт broadcast как readOnly + extraData', async () => {
    mockFetchOnce({ json: async () => ({ channel: { _id: 'ch1', t: 'c' } }) });
    const client = new RocketChatRestClient(session);

    await client.createChannel('Объявления', ['ivan', 'petr'], true);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      name: 'Объявления',
      members: ['ivan', 'petr'],
      readOnly: true,
      extraData: { broadcast: true },
    });
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

  it('бросает RocketChatApiError при неуспешном ответе', async () => {
    mockFetchOnce({ ok: false, status: 401, json: async () => ({ error: 'Недействительный токен' }) });
    const client = new RocketChatRestClient(session);

    await expect(client.listSubscriptions()).rejects.toThrow(RocketChatApiError);
    await expect(client.listSubscriptions()).rejects.toThrow('Недействительный токен');
  });
});
