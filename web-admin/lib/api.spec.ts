import { apiFetch, ApiError } from './api';

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  }) as unknown as typeof fetch;
}

describe('apiFetch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('добавляет заголовок Authorization, если передан token', async () => {
    mockFetchOnce({ json: async () => ({ ok: true }) });

    await apiFetch('/users/me', { token: 'test-access-token' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-access-token');
  });

  it('не добавляет заголовок Authorization без token', async () => {
    mockFetchOnce({ json: async () => ({ ok: true }) });

    await apiFetch('/invites');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('возвращает распарсенный JSON при успешном ответе', async () => {
    mockFetchOnce({ json: async () => ({ id: '1', name: 'Тест' }) });

    const result = await apiFetch<{ id: string; name: string }>('/members/1');

    expect(result).toEqual({ id: '1', name: 'Тест' });
  });

  it('возвращает undefined для статуса 204', async () => {
    mockFetchOnce({ status: 204, json: async () => ({}) });

    const result = await apiFetch('/invites/1');

    expect(result).toBeUndefined();
  });

  it('бросает ApiError с сообщением из тела ответа при ошибке', async () => {
    mockFetchOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Недостаточно прав' }),
    });

    await expect(apiFetch('/roles')).rejects.toThrow(ApiError);
    await expect(apiFetch('/roles')).rejects.toThrow('Недостаточно прав');
  });

  it('использует statusText, если тело ответа с ошибкой не парсится', async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(apiFetch('/roles')).rejects.toThrow('Internal Server Error');
  });
});
