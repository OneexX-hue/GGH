import { randomUUID } from 'node:crypto';
import type {
  ClaimQualityRequest,
  Player,
  SubmissionStatus,
  SubmitCodeRequest,
  SubmitCodeResponse,
} from '@workspace/core';
import { acceptsSubmissions, checkGeo, codesMatch } from '@workspace/core';
import { rowToAdminTask, rowToQualityCode } from '@workspace/db';
import type { AppContext } from '../context.ts';
import { notFound } from '../errors.ts';
import { findEventById } from './events.ts';

type Row = Record<string, unknown>;

/** Не больше стольких попыток на команду в минуту — против перебора кодов. */
const RATE_LIMIT_ATTEMPTS = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function submitCode(ctx: AppContext, player: Player, body: SubmitCodeRequest): SubmitCodeResponse {
  const now = Date.now();

  const event = findEventById(ctx, player.eventId);

  // Повтор из офлайн-очереди: отдаём тот же результат, что и в первый раз,
  // ничего не начисляя повторно.
  const replay = findReplay(ctx, player.teamId, body.idempotencyKey);
  if (replay) return replay;

  if (!acceptsSubmissions(event, now)) {
    return reject(ctx, player, body, 'game_not_running', null);
  }

  if (isRateLimited(ctx, player.teamId, now)) {
    return reject(ctx, player, body, 'rate_limited', null);
  }

  const taskRow = ctx.db.prepare('SELECT * FROM tasks WHERE id = ? AND event_id = ?').get(body.taskId, event.id) as
    | Row
    | undefined;
  if (!taskRow) throw notFound('Задание не найдено');
  const task = rowToAdminTask(taskRow);

  const alreadySolved = ctx.db
    .prepare("SELECT 1 FROM submissions WHERE team_id = ? AND task_id = ? AND status = 'accepted'")
    .get(player.teamId, task.id);
  if (alreadySolved) {
    return reject(ctx, player, body, 'already_solved', null);
  }

  const geo = checkGeo(task, body.coords);
  if (!geo.ok) {
    return reject(ctx, player, body, 'too_far', geo.distanceM);
  }

  if (task.code === null || !codesMatch(body.code, task.code)) {
    return reject(ctx, player, body, 'wrong_code', geo.distanceM);
  }

  return accept(ctx, player, body, task.points, geo.distanceM);
}

export function claimQuality(ctx: AppContext, player: Player, body: ClaimQualityRequest): SubmitCodeResponse {
  const now = Date.now();

  const event = findEventById(ctx, player.eventId);

  const replay = findQualityReplay(ctx, player.teamId, body.idempotencyKey);
  if (replay) return replay;

  if (!acceptsSubmissions(event, now)) {
    logAttempt(ctx, player, body.taskId, body.code, false, 'game_not_running');
    return response('rejected', 'game_not_running', null);
  }

  const codeRow = ctx.db
    .prepare('SELECT * FROM quality_codes WHERE event_id = ?')
    .all(event.id)
    .map((row) => rowToQualityCode(row as Row))
    .find((qc) => codesMatch(qc.code, body.code));

  if (!codeRow) {
    logAttempt(ctx, player, body.taskId, body.code, false, 'wrong_code');
    return response('rejected', 'wrong_code', null);
  }

  try {
    ctx.db
      .prepare(
        `INSERT INTO quality_claims (id, event_id, team_id, task_id, quality_code_id, player_id, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), event.id, player.teamId, body.taskId, codeRow.id, player.id, body.idempotencyKey, now);
  } catch {
    // Сработал UNIQUE (team_id, task_id) — оценка за это задание уже стоит.
    logAttempt(ctx, player, body.taskId, body.code, false, 'already_solved');
    return response('rejected', 'already_solved', null);
  }

  logAttempt(ctx, player, body.taskId, body.code, true, null);
  ctx.hub.publish(event.id, { type: 'scoreboard' });
  return response('accepted', null, null);
}

/* ------------------------------------------------------------- внутреннее */

function accept(
  ctx: AppContext,
  player: Player,
  body: SubmitCodeRequest,
  points: number,
  distanceM: number | null,
): SubmitCodeResponse {
  try {
    insertSubmission(ctx, player, body, 'accepted', points);
  } catch {
    // Гонка двух устройств одной команды: партиальный UNIQUE-индекс не пустил
    // второй зачёт. Это не ошибка — задание просто уже закрыто.
    return reject(ctx, player, body, 'already_solved', distanceM);
  }

  logAttempt(ctx, player, body.taskId, body.code, true, null);
  ctx.hub.publish(player.eventId, { type: 'scoreboard' });
  return response('accepted', null, distanceM);
}

function reject(
  ctx: AppContext,
  player: Player,
  body: SubmitCodeRequest,
  reason: NonNullable<SubmitCodeResponse['reason']>,
  distanceM: number | null,
): SubmitCodeResponse {
  // Отказ тоже сохраняется под ключом идемпотентности: повтор из очереди
  // не должен внезапно дать другой ответ.
  try {
    insertSubmission(ctx, player, body, 'rejected', 0);
  } catch {
    /* дубль ключа — запись уже есть */
  }
  logAttempt(ctx, player, body.taskId, body.code, false, reason);
  return response('rejected', reason, distanceM);
}

function insertSubmission(
  ctx: AppContext,
  player: Player,
  body: SubmitCodeRequest,
  status: SubmissionStatus,
  points: number,
): void {
  ctx.db
    .prepare(
      `INSERT INTO submissions (id, event_id, task_id, team_id, player_id, idempotency_key, status, points_awarded, lat, lng, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      player.eventId,
      body.taskId,
      player.teamId,
      player.id,
      body.idempotencyKey,
      status,
      points,
      body.coords?.lat ?? null,
      body.coords?.lng ?? null,
      Date.now(),
    );
}

function findReplay(
  ctx: AppContext,
  teamId: string,
  idempotencyKey: string,
): SubmitCodeResponse | null {
  const row = ctx.db
    .prepare('SELECT status FROM submissions WHERE team_id = ? AND idempotency_key = ?')
    .get(teamId, idempotencyKey) as Row | undefined;
  if (!row) return null;

  const status = String(row['status']) as SubmissionStatus;
  return response(status, status === 'accepted' ? null : 'already_solved', null);
}

function findQualityReplay(
  ctx: AppContext,
  teamId: string,
  idempotencyKey: string,
): SubmitCodeResponse | null {
  const row = ctx.db
    .prepare('SELECT 1 FROM quality_claims WHERE team_id = ? AND idempotency_key = ?')
    .get(teamId, idempotencyKey) as Row | undefined;
  if (!row) return null;
  return response('accepted', null, null);
}

function isRateLimited(ctx: AppContext, teamId: string, now: number): boolean {
  const row = ctx.db
    .prepare('SELECT COUNT(*) AS n FROM attempt_log WHERE team_id = ? AND ok = 0 AND created_at > ?')
    .get(teamId, now - RATE_LIMIT_WINDOW_MS) as Row | undefined;
  return Number(row?.['n'] ?? 0) >= RATE_LIMIT_ATTEMPTS;
}

function logAttempt(
  ctx: AppContext,
  player: Player,
  taskId: string | null,
  value: string,
  ok: boolean,
  reason: string | null,
): void {
  ctx.db
    .prepare(
      `INSERT INTO attempt_log (id, event_id, team_id, player_id, task_id, value, ok, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), player.eventId, player.teamId, player.id, taskId, value, ok ? 1 : 0, reason, Date.now());
}

/** Баллы в ответе игроку не передаются: счёт — сведения для организатора. */
function response(
  status: SubmissionStatus,
  reason: SubmitCodeResponse['reason'],
  distanceM: number | null,
): SubmitCodeResponse {
  return { status, reason, distanceM };
}
