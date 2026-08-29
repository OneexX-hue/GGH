import type {
  ClaimQualityRequest,
  EventArchive,
  GameState,
  Player,
  QualityCode,
  RegisterRequest,
  RegisterResponse,
  Scoreboard,
  SubmitCodeRequest,
  SubmitCodeResponse,
  Task,
  Team,
} from '@workspace/core';

/**
 * Транспорт к API. Общий для веба и для Expo — здесь нет ни DOM, ни React Native,
 * только fetch (есть в обоих) и абстрактное хранилище токена.
 */

export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PlayerTask extends Omit<Task, 'points'> {
  /** null у сданного задания: номинал сданного — это заработанные баллы. */
  points: number | null;
  solved: boolean;
  qualityClaimed: boolean;
}

export interface TasksResponse {
  tasks: PlayerTask[];
  serverTime: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** Ошибка сети или 5xx — попытку имеет смысл повторить позже из очереди. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export interface QuestClientOptions {
  baseUrl: string;
  eventSlug: string;
  storage: TokenStorage;
  /** Админский секрет. Задаётся только в админке, в клиенте игрока его нет. */
  adminToken?: string;
}

export class QuestClient {
  readonly baseUrl: string;
  readonly eventSlug: string;
  #storage: TokenStorage;
  #adminToken: string | undefined;

  constructor(options: QuestClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.eventSlug = options.eventSlug;
    this.#storage = options.storage;
    this.#adminToken = options.adminToken;
  }

  setAdminToken(token: string | undefined): void {
    this.#adminToken = token;
  }

  /* ------------------------------------------------------------ публичное */

  gameState(): Promise<GameState> {
    return this.#request('GET', `/api/events/${this.eventSlug}/state`);
  }

  // Метода scoreboard() для игрока нет: табло существует только в админке.

  streamUrl(): string {
    return `${this.baseUrl}/api/events/${this.eventSlug}/stream`;
  }

  /* --------------------------------------------------------------- игрок */

  async register(input: Omit<RegisterRequest, 'eventSlug'>): Promise<RegisterResponse> {
    const result = await this.#request<RegisterResponse>('POST', '/api/register', {
      ...input,
      eventSlug: this.eventSlug,
    });
    await this.#storage.set(result.token);
    return result;
  }

  me(): Promise<{ player: Player; team: Team }> {
    return this.#request('GET', '/api/me', undefined, true);
  }

  tasks(): Promise<TasksResponse> {
    return this.#request('GET', '/api/tasks', undefined, true);
  }

  qualityCodes(): Promise<Pick<QualityCode, 'id' | 'points' | 'label'>[]> {
    return this.#request('GET', '/api/quality-codes', undefined, true);
  }

  submitCode(body: SubmitCodeRequest): Promise<SubmitCodeResponse> {
    return this.#request('POST', '/api/submissions/code', body, true);
  }

  claimQuality(body: ClaimQualityRequest): Promise<SubmitCodeResponse> {
    return this.#request('POST', '/api/submissions/quality', body, true);
  }

  logout(): Promise<void> {
    return this.#storage.clear();
  }

  /* --------------------------------------------------------------- админ */

  admin = {
    command: (action: string, extra: { durationMs?: number; confirmation?: string } = {}): Promise<GameState> =>
      this.#request('POST', `/api/admin/events/${this.eventSlug}/command`, { action, ...extra }),
    scoreboard: (): Promise<Scoreboard> => this.#request('GET', `/api/admin/events/${this.eventSlug}/scoreboard`),
    archives: (): Promise<EventArchive[]> => this.#request('GET', '/api/admin/archives'),
    tasks: <T>(): Promise<T> => this.#request('GET', `/api/admin/events/${this.eventSlug}/tasks`),
    createTask: <T>(body: unknown): Promise<T> =>
      this.#request('POST', `/api/admin/events/${this.eventSlug}/tasks`, body),
    updateTask: <T>(taskId: string, body: unknown): Promise<T> =>
      this.#request('PUT', `/api/admin/events/${this.eventSlug}/tasks/${taskId}`, body),
    deleteTask: (taskId: string): Promise<void> =>
      this.#request('DELETE', `/api/admin/events/${this.eventSlug}/tasks/${taskId}`),
    players: <T>(): Promise<T> => this.#request('GET', `/api/admin/events/${this.eventSlug}/players`),
    attempts: <T>(): Promise<T> => this.#request('GET', `/api/admin/events/${this.eventSlug}/attempts`),
    qualityCodes: (): Promise<QualityCode[]> =>
      this.#request('GET', `/api/admin/events/${this.eventSlug}/quality-codes`),
    exportCsvUrl: (): string => `${this.baseUrl}/api/admin/events/${this.eventSlug}/export.csv`,
  };

  /* ------------------------------------------------------------ транспорт */

  async #request<T>(method: string, path: string, body?: unknown, withPlayerAuth = false): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    if (withPlayerAuth) {
      const token = await this.#storage.get();
      if (!token) throw new ApiError(401, 'no_token', 'Игрок не зарегистрирован на этом устройстве');
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.#adminToken) headers['X-Admin-Token'] = this.#adminToken;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      // Статус 0 отличает «сети нет» от «сервер ответил отказом»: первое уходит
      // в офлайн-очередь, второе показывается игроку как результат.
      throw new ApiError(0, 'network_error', error instanceof Error ? error.message : 'Нет соединения');
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload: unknown = text.length > 0 ? safeJson(text) : null;

    if (!response.ok) {
      const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(response.status, err?.code ?? 'http_error', err?.message ?? `HTTP ${response.status}`);
    }

    return payload as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Хранилище токена в памяти — фолбэк, когда постоянное недоступно. */
export function memoryTokenStorage(): TokenStorage {
  let token: string | null = null;
  return {
    get: async () => token,
    set: async (value) => {
      token = value;
    },
    clear: async () => {
      token = null;
    },
  };
}
