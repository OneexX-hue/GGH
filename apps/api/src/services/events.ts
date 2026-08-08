import { randomUUID } from 'node:crypto';
import type { EventArchive, GameCommand, GameState, QuestEvent } from '@workspace/core';
import { computeClock } from '@workspace/core';
import { rowToEvent } from '@workspace/db';
import type { AppContext } from '../context.ts';
import { badRequest, notFound } from '../errors.ts';
import { computeRows } from './scoring.ts';

type Row = Record<string, unknown>;

/* --------------------------------------------------------------- чтение */

function readEvent(ctx: AppContext, where: 'id' | 'slug', value: string): QuestEvent {
  const row = ctx.db.prepare(`SELECT * FROM events WHERE ${where} = ?`).get(value) as Row | undefined;
  if (!row) throw notFound(where === 'slug' ? `Событие «${value}» не найдено` : 'Событие не найдено');
  return rowToEvent(row);
}

export function findEventBySlug(ctx: AppContext, slug: string): QuestEvent {
  return syncExpired(ctx, readEvent(ctx, 'slug', slug));
}

export function findEventById(ctx: AppContext, id: string): QuestEvent {
  return syncExpired(ctx, readEvent(ctx, 'id', id));
}

/**
 * Итоги видны игрокам только после завершения игры.
 *
 * Пока квест идёт, счёт и места скрыты: иначе команда, увидевшая недосягаемый
 * отрыв лидера, перестаёт стараться, а лидер — рисковать. Организатор видит
 * табло всегда.
 */
export function resultsPublished(event: QuestEvent): boolean {
  return event.status === 'finished';
}

export function toGameState(event: QuestEvent, now = Date.now()): GameState {
  const clock = computeClock(event, now);
  return {
    event,
    serverTime: now,
    remainingMs: clock.remainingMs,
    elapsedMs: clock.elapsedMs,
    resultsPublished: resultsPublished(event),
  };
}

/**
 * Перевод истёкшей игры в 'finished'.
 *
 * Таймер кончается сам по себе, без чьего-либо запроса, поэтому статус надо
 * догонять. Вызывается при каждом чтении события и вдобавок по расписанию
 * (см. startAutoFinish) — иначе игра, у которой вышло время, осталась бы
 * в статусе 'running' с открытой регистрацией.
 */
function syncExpired(ctx: AppContext, event: QuestEvent): QuestEvent {
  if (event.status !== 'running') return event;
  if (computeClock(event, Date.now()).remainingMs > 0) return event;

  finish(ctx, event, 'timer');
  return readEvent(ctx, 'id', event.id);
}

/**
 * Фоновая проверка истёкших игр.
 *
 * Ленивой синхронизации при чтении мало: если в момент конца времени никто
 * не делает запросов, SSE промолчит и клиенты узнают о финале с опозданием.
 */
export function startAutoFinish(ctx: AppContext, intervalMs = 5_000): () => void {
  const timer = setInterval(() => {
    const rows = ctx.db.prepare("SELECT * FROM events WHERE status = 'running'").all() as Row[];
    for (const row of rows) syncExpired(ctx, rowToEvent(row));
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

/* ----------------------------------------------------------- управление */

export function applyCommand(ctx: AppContext, event: QuestEvent, command: GameCommand): QuestEvent {
  const now = Date.now();

  switch (command.action) {
    case 'start': {
      if (event.status === 'running') throw badRequest('Игра уже идёт');
      if (event.status === 'finished') throw badRequest('Игра завершена. Чтобы начать заново, сделайте сброс');
      update(ctx, event.id, {
        status: 'running',
        duration_ms: command.durationMs ?? event.durationMs,
        started_at: now,
        paused_at: null,
        total_paused_ms: 0,
      });
      break;
    }

    case 'pause': {
      if (event.status !== 'running') throw badRequest('Поставить на паузу можно только идущую игру');
      update(ctx, event.id, { status: 'paused', paused_at: now });
      break;
    }

    case 'resume': {
      if (event.status !== 'paused' || event.pausedAt === null) throw badRequest('Игра не на паузе');
      // Длительность паузы уходит в накопитель — только так остаток не «сгорает».
      update(ctx, event.id, {
        status: 'running',
        paused_at: null,
        total_paused_ms: event.totalPausedMs + (now - event.pausedAt),
      });
      break;
    }

    case 'stop': {
      if (event.status === 'draft') throw badRequest('Игра ещё не запускалась');
      if (event.status === 'finished') throw badRequest('Игра уже завершена');
      finish(ctx, event, 'admin');
      break;
    }

    case 'reset': {
      // Сброс удаляет результаты всех команд. Название события как подтверждение —
      // защита от промаха по кнопке; снимок в архив — защита от осознанной ошибки.
      if (command.confirmation !== event.name) {
        throw badRequest(`Для сброса введите точное название события: «${event.name}»`);
      }
      archive(ctx, event, 'reset');
      ctx.db.prepare('DELETE FROM submissions WHERE event_id = ?').run(event.id);
      ctx.db.prepare('DELETE FROM quality_claims WHERE event_id = ?').run(event.id);
      ctx.db.prepare('DELETE FROM attempt_log WHERE event_id = ?').run(event.id);
      update(ctx, event.id, { status: 'draft', started_at: null, paused_at: null, total_paused_ms: 0 });
      break;
    }
  }

  ctx.hub.publish(event.id, { type: 'game-state' });
  ctx.hub.publish(event.id, { type: 'scoreboard' });
  return readEvent(ctx, 'id', event.id);
}

/** Завершение игры: статус, снимок итогов, рассылка клиентам. */
function finish(ctx: AppContext, event: QuestEvent, _reason: 'timer' | 'admin'): void {
  // paused_at служит отметкой остановки часов — и для паузы, и для финала.
  update(ctx, event.id, { status: 'finished', paused_at: Date.now() });
  archive(ctx, event, 'finished');
  // Итоги только что опубликованы — клиентам надо перерисовать и таймер, и табло.
  ctx.hub.publish(event.id, { type: 'game-state' });
  ctx.hub.publish(event.id, { type: 'scoreboard' });
}

function archive(ctx: AppContext, event: QuestEvent, reason: 'finished' | 'reset'): void {
  const rows = computeRows(ctx, event.id);
  // Пустую игру архивировать незачем — архив засорится черновиками.
  if (rows.length === 0) return;

  ctx.db
    .prepare(
      `INSERT INTO event_archives
         (id, event_id, event_name, event_slug, reason, finished_at, duration_ms, team_count, results_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      event.id,
      event.name,
      event.slug,
      reason,
      Date.now(),
      computeClock(event, Date.now()).elapsedMs,
      rows.length,
      JSON.stringify(rows),
      Date.now(),
    );
}

export function listArchives(ctx: AppContext): EventArchive[] {
  const rows = ctx.db.prepare('SELECT * FROM event_archives ORDER BY created_at DESC LIMIT 100').all() as Row[];
  return rows.map((row) => ({
    id: String(row['id']),
    eventId: String(row['event_id']),
    eventName: String(row['event_name']),
    eventSlug: String(row['event_slug']),
    reason: String(row['reason']) as EventArchive['reason'],
    finishedAt: Number(row['finished_at']),
    durationMs: Number(row['duration_ms']),
    teamCount: Number(row['team_count']),
    rows: JSON.parse(String(row['results_json'])) as EventArchive['rows'],
  }));
}

/* -------------------------------------------------------------- запись */

type EventPatch = Partial<{
  status: string;
  duration_ms: number;
  started_at: number | null;
  paused_at: number | null;
  total_paused_ms: number;
}>;

function update(ctx: AppContext, eventId: string, patch: EventPatch): void {
  const entries = Object.entries(patch);
  if (entries.length === 0) return;
  const setters = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value as string | number | null);
  ctx.db.prepare(`UPDATE events SET ${setters} WHERE id = ?`).run(...values, eventId);
}
