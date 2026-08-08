import type { Response } from 'express';

/**
 * SSE-рассылка изменений состояния игры.
 *
 * Почему SSE, а не WebSocket: нужен только односторонний поток «сервер → клиент»,
 * SSE работает поверх обычного HTTP (проще за прокси), сам переподключается
 * и не требует зависимостей в Express 5. Клиенты, у которых SSE не поднялся,
 * откатываются на опрос — состояние всё равно приходит целиком.
 */
export type HubEvent =
  | { type: 'game-state' }
  | { type: 'tasks-changed' }
  | { type: 'scoreboard' };

interface Subscriber {
  eventId: string;
  res: Response;
}

const HEARTBEAT_MS = 25_000;

export class EventHub {
  #subscribers = new Set<Subscriber>();
  #heartbeat: NodeJS.Timeout | null = null;

  subscribe(eventId: string, res: Response): () => void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Отключает буферизацию в nginx — иначе события копятся и приходят пачкой.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const subscriber: Subscriber = { eventId, res };
    this.#subscribers.add(subscriber);
    this.#ensureHeartbeat();

    res.write(': connected\n\n');

    return () => {
      this.#subscribers.delete(subscriber);
      if (this.#subscribers.size === 0) this.#stopHeartbeat();
    };
  }

  publish(eventId: string, event: HubEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const subscriber of this.#subscribers) {
      if (subscriber.eventId !== eventId) continue;
      try {
        subscriber.res.write(payload);
      } catch {
        // Разорванное соединение вычистит обработчик 'close'.
      }
    }
  }

  closeAll(): void {
    for (const subscriber of this.#subscribers) subscriber.res.end();
    this.#subscribers.clear();
    this.#stopHeartbeat();
  }

  /** Комментарии-пинги не дают прокси закрыть простаивающее соединение. */
  #ensureHeartbeat(): void {
    if (this.#heartbeat) return;
    this.#heartbeat = setInterval(() => {
      for (const subscriber of this.#subscribers) {
        try {
          subscriber.res.write(': ping\n\n');
        } catch {
          /* см. выше */
        }
      }
    }, HEARTBEAT_MS);
    this.#heartbeat.unref?.();
  }

  #stopHeartbeat(): void {
    if (!this.#heartbeat) return;
    clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }
}
