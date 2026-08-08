import type { QuestEvent } from './schemas.ts';

/**
 * Таймер игры считается ТОЛЬКО из полей события и текущего времени сервера.
 *
 * Смысл: устройство игрока не участвует в вычислении. Перевод системных часов
 * на телефоне не добавляет и не отнимает ни секунды, а клиенты в разных
 * часовых поясах видят один и тот же остаток.
 */
export interface ClockView {
  elapsedMs: number;
  remainingMs: number;
  isRunning: boolean;
  isOver: boolean;
}

export function computeClock(event: Pick<QuestEvent, 'status' | 'durationMs' | 'startedAt' | 'pausedAt' | 'totalPausedMs'>, now: number): ClockView {
  const { status, durationMs, startedAt, pausedAt, totalPausedMs } = event;

  if (startedAt === null || status === 'draft') {
    return { elapsedMs: 0, remainingMs: durationMs, isRunning: false, isOver: false };
  }

  // Часы замирают в момент pausedAt — и на паузе, и на финале: в обоих случаях
  // там лежит время остановки. Иначе завершённая игра продолжала бы «тратить»
  // время, и через час после финала показывала бы совсем другой остаток.
  const frozen = (status === 'paused' || status === 'finished') && pausedAt !== null;
  const reference = frozen ? pausedAt : now;
  const rawElapsed = reference - startedAt - totalPausedMs;
  const elapsedMs = clamp(rawElapsed, 0, durationMs);
  const remainingMs = durationMs - elapsedMs;

  return {
    elapsedMs,
    remainingMs,
    isRunning: status === 'running' && remainingMs > 0,
    isOver: status === 'finished' || remainingMs <= 0,
  };
}

/** Принимаются ли сейчас ответы. Единая проверка для сервера и для UI. */
export function acceptsSubmissions(event: Pick<QuestEvent, 'status' | 'durationMs' | 'startedAt' | 'pausedAt' | 'totalPausedMs'>, now: number): boolean {
  return event.status === 'running' && computeClock(event, now).remainingMs > 0;
}

/**
 * Смещение часов устройства относительно сервера, в миллисекундах.
 * Клиент вычисляет его один раз на ответ и дальше тикает локально, не дёргая сеть.
 */
export function clockSkew(serverTime: number, deviceTime: number = Date.now()): number {
  return serverTime - deviceTime;
}

/** Локальная оценка серверного времени между запросами — для плавного тика раз в секунду. */
export function estimateServerNow(skewMs: number, deviceTime: number = Date.now()): number {
  return deviceTime + skewMs;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
