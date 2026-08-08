import type { GameCommand, GameState, QuestEvent } from '@workspace/core';
import { computeClock } from '@workspace/core';
import { rowToEvent } from '@workspace/db';
import type { AppContext } from '../context.ts';
import { badRequest, notFound } from '../errors.ts';

export function findEventBySlug(ctx: AppContext, slug: string): QuestEvent {
  const row = ctx.db.prepare('SELECT * FROM events WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  if (!row) throw notFound(`Событие «${slug}» не найдено`);
  return rowToEvent(row);
}

export function findEventById(ctx: AppContext, id: string): QuestEvent {
  const row = ctx.db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) throw notFound('Событие не найдено');
  return rowToEvent(row);
}

export function toGameState(event: QuestEvent, now = Date.now()): GameState {
  const clock = computeClock(event, now);
  return { event, serverTime: now, remainingMs: clock.remainingMs, elapsedMs: clock.elapsedMs };
}

/**
 * Переходы состояния игры. Все они меняют только поля события — производные
 * величины (остаток, прошедшее время) нигде не хранятся и всегда пересчитываются.
 */
export function applyCommand(ctx: AppContext, event: QuestEvent, command: GameCommand): QuestEvent {
  const now = Date.now();
  const { action } = command;

  switch (action) {
    case 'start': {
      if (event.status === 'running') throw badRequest('Игра уже идёт');
      const durationMs = command.durationMs ?? event.durationMs;
      update(ctx, event.id, {
        status: 'running',
        duration_ms: durationMs,
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
      update(ctx, event.id, { status: 'finished', paused_at: null });
      break;
    }

    case 'reset': {
      // Сбрасывает и часы, и результаты: команда для повторного прогона квеста.
      ctx.db.prepare('DELETE FROM submissions WHERE event_id = ?').run(event.id);
      ctx.db.prepare('DELETE FROM quality_claims WHERE event_id = ?').run(event.id);
      ctx.db.prepare('DELETE FROM attempt_log WHERE event_id = ?').run(event.id);
      update(ctx, event.id, { status: 'draft', started_at: null, paused_at: null, total_paused_ms: 0 });
      break;
    }
  }

  ctx.hub.publish(event.id, { type: 'game-state' });
  return findEventById(ctx, event.id);
}

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
