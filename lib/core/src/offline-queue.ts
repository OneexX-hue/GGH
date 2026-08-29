/**
 * Офлайн-очередь отправок.
 *
 * Городской квест проходит во дворах и подвалах, где сети нет. Игрок вводит код,
 * очередь кладёт его в постоянное хранилище и отдаёт UI оптимистичный ответ;
 * при появлении сети попытки уходят на сервер в порядке добавления.
 *
 * Ключ идемпотентности генерируется в момент постановки в очередь, поэтому
 * повторная отправка после обрыва не начисляет баллы дважды.
 *
 * Хранилище абстрактно: localStorage в вебе, AsyncStorage в Expo.
 */

export interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface QueuedSubmission<TPayload> {
  idempotencyKey: string;
  payload: TPayload;
  queuedAt: number;
  attempts: number;
  lastError: string | null;
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

const DEFAULT_KEY = 'quest:submission-queue:v1';
/** После стольких неудач попытка считается безнадёжной и выбрасывается из очереди. */
const MAX_ATTEMPTS = 8;

export class OfflineQueue<TPayload> {
  #storage: QueueStorage;
  #key: string;
  #items: QueuedSubmission<TPayload>[] = [];
  #loaded = false;
  /** Сериализует flush: параллельные вызовы не должны отправлять одно и то же дважды. */
  #inFlight: Promise<FlushResult> | null = null;

  constructor(storage: QueueStorage, key: string = DEFAULT_KEY) {
    this.#storage = storage;
    this.#key = key;
  }

  async enqueue(payload: TPayload, idempotencyKey: string): Promise<QueuedSubmission<TPayload>> {
    await this.#load();
    const existing = this.#items.find((i) => i.idempotencyKey === idempotencyKey);
    if (existing) return existing;

    const item: QueuedSubmission<TPayload> = {
      idempotencyKey,
      payload,
      queuedAt: Date.now(),
      attempts: 0,
      lastError: null,
    };
    this.#items.push(item);
    await this.#persist();
    return item;
  }

  async pending(): Promise<QueuedSubmission<TPayload>[]> {
    await this.#load();
    return [...this.#items];
  }

  async size(): Promise<number> {
    await this.#load();
    return this.#items.length;
  }

  /**
   * Отправляет накопленное. `send` должен бросать исключение при неуспехе —
   * тогда попытка остаётся в очереди. Отказ сервера по существу (неверный код)
   * это НЕ исключение: попытка доставлена и из очереди уходит.
   */
  async flush(send: (payload: TPayload, idempotencyKey: string) => Promise<void>): Promise<FlushResult> {
    if (this.#inFlight) return this.#inFlight;
    this.#inFlight = this.#flushInner(send).finally(() => {
      this.#inFlight = null;
    });
    return this.#inFlight;
  }

  async #flushInner(send: (payload: TPayload, idempotencyKey: string) => Promise<void>): Promise<FlushResult> {
    await this.#load();
    let sent = 0;
    let failed = 0;
    const survivors: QueuedSubmission<TPayload>[] = [];

    // Порядок важен: код, введённый раньше, должен и засчитаться раньше.
    for (const item of this.#items) {
      try {
        await send(item.payload, item.idempotencyKey);
        sent += 1;
      } catch (error) {
        item.attempts += 1;
        item.lastError = error instanceof Error ? error.message : String(error);
        failed += 1;
        if (item.attempts < MAX_ATTEMPTS) survivors.push(item);
      }
    }

    this.#items = survivors;
    await this.#persist();
    return { sent, failed, remaining: survivors.length };
  }

  async #load(): Promise<void> {
    if (this.#loaded) return;
    const raw = await this.#storage.getItem(this.#key);
    this.#items = raw ? safeParse<TPayload>(raw) : [];
    this.#loaded = true;
  }

  async #persist(): Promise<void> {
    await this.#storage.setItem(this.#key, JSON.stringify(this.#items));
  }
}

function safeParse<TPayload>(raw: string): QueuedSubmission<TPayload>[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedSubmission<TPayload>[]) : [];
  } catch {
    // Повреждённое хранилище не должно ронять приложение на старте игры.
    return [];
  }
}

/** Хранилище в памяти — для тестов и для сред без персистентности. */
export function memoryStorage(): QueueStorage {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
  };
}
