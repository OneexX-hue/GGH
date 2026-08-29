import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsSubmissions, computeClock, formatDuration } from './clock.ts';
import type { QuestEvent } from './schemas.ts';

const HOUR = 3_600_000;
const base: Pick<QuestEvent, 'status' | 'durationMs' | 'startedAt' | 'pausedAt' | 'totalPausedMs'> = {
  status: 'draft',
  durationMs: 2 * HOUR,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
};

test('до старта показывает полную длительность', () => {
  const clock = computeClock(base, 1_000_000);
  assert.equal(clock.remainingMs, 2 * HOUR);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(clock.isRunning, false);
});

test('во время игры остаток уменьшается', () => {
  const clock = computeClock({ ...base, status: 'running', startedAt: 1000 }, 1000 + HOUR);
  assert.equal(clock.elapsedMs, HOUR);
  assert.equal(clock.remainingMs, HOUR);
  assert.equal(clock.isRunning, true);
});

test('на паузе часы замирают независимо от того, сколько прошло реально', () => {
  const paused = { ...base, status: 'paused' as const, startedAt: 1000, pausedAt: 1000 + HOUR, totalPausedMs: 0 };
  const afterOneMinute = computeClock(paused, 1000 + HOUR + 60_000);
  const afterOneHour = computeClock(paused, 1000 + 2 * HOUR);
  assert.equal(afterOneMinute.remainingMs, HOUR);
  assert.equal(afterOneHour.remainingMs, HOUR, 'длина паузы не должна влиять на остаток');
});

test('после снятия с паузы время паузы не съедает игру', () => {
  // Старт в 1000, час игры, полчаса паузы, затем продолжение ещё на полчаса.
  const resumed = { ...base, status: 'running' as const, startedAt: 1000, pausedAt: null, totalPausedMs: HOUR / 2 };
  const clock = computeClock(resumed, 1000 + HOUR + HOUR / 2 + HOUR / 2);
  assert.equal(clock.elapsedMs, 1.5 * HOUR);
  assert.equal(clock.remainingMs, 0.5 * HOUR);
});

test('остаток не уходит в минус после конца времени', () => {
  const clock = computeClock({ ...base, status: 'running', startedAt: 1000 }, 1000 + 10 * HOUR);
  assert.equal(clock.remainingMs, 0);
  assert.equal(clock.elapsedMs, 2 * HOUR);
  assert.equal(clock.isOver, true);
  assert.equal(clock.isRunning, false);
});

test('ответы принимаются только в идущей игре с ненулевым остатком', () => {
  const running = { ...base, status: 'running' as const, startedAt: 1000 };
  assert.equal(acceptsSubmissions(running, 1000 + HOUR), true);
  assert.equal(acceptsSubmissions(running, 1000 + 3 * HOUR), false, 'время вышло');
  assert.equal(acceptsSubmissions({ ...running, status: 'paused', pausedAt: 2000 }, 5000), false);
  assert.equal(acceptsSubmissions(base, 5000), false, 'игра не запускалась');
});

test('часы замирают на финале, а не продолжают идти', () => {
  // Игру остановили через полчаса после старта.
  const finished = { ...base, status: 'finished' as const, startedAt: 1000, pausedAt: 1000 + HOUR / 2 };

  const rightAfter = computeClock(finished, 1000 + HOUR / 2 + 1000);
  const dayLater = computeClock(finished, 1000 + 24 * HOUR);

  assert.equal(rightAfter.elapsedMs, HOUR / 2);
  assert.equal(dayLater.elapsedMs, HOUR / 2, 'через сутки игра всё ещё шла полчаса');
  assert.equal(dayLater.remainingMs, 1.5 * HOUR, 'остаток на момент остановки не меняется');
  assert.equal(dayLater.isOver, true);
  assert.equal(dayLater.isRunning, false);
});

test('игра, завершённая по истечении времени, показывает нулевой остаток', () => {
  const expired = { ...base, status: 'finished' as const, startedAt: 1000, pausedAt: 1000 + 2 * HOUR };
  const clock = computeClock(expired, 1000 + 5 * HOUR);
  assert.equal(clock.remainingMs, 0);
  assert.equal(clock.elapsedMs, 2 * HOUR);
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(65_000), '01:05');
  assert.equal(formatDuration(2 * HOUR + 61_000), '2:01:01');
  assert.equal(formatDuration(-5000), '00:00');
});
