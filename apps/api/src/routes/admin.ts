import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { GameCommand, TaskUpsert, normalizeCode, taskQrPayload } from '@workspace/core';
import { rowToAdminTask, rowToPlayer, rowToQualityCode } from '@workspace/db';
import { requireAdmin } from '../auth.ts';
import type { AppContext } from '../context.ts';
import { notFound } from '../errors.ts';
import { applyCommand, findEventBySlug, listArchives, toGameState } from '../services/events.ts';
import { buildScoreboard } from '../services/scoring.ts';

type Row = Record<string, unknown>;

export function adminRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAdmin(ctx));

  router.get('/events', (_req, res) => {
    const rows = ctx.db.prepare('SELECT slug, name, status FROM events ORDER BY created_at DESC').all() as Row[];
    res.json(rows);
  });

  /** Управление игрой: старт / пауза / продолжить / стоп / сброс. */
  router.post('/events/:slug/command', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const updated = applyCommand(ctx, event, GameCommand.parse(req.body));
    res.json(toGameState(updated));
  });

  router.get('/events/:slug/tasks', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const rows = ctx.db.prepare('SELECT * FROM tasks WHERE event_id = ? ORDER BY order_index').all(event.id) as Row[];
    res.json(
      rows.map(rowToAdminTask).map((task) => ({
        ...task,
        // Готовый QR для печати: организатор клеит его на точке вместо таблички с кодом.
        qrPayload: task.code === null ? null : taskQrPayload(event.slug, task.code),
      })),
    );
  });

  router.post('/events/:slug/tasks', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const body = TaskUpsert.parse(req.body);
    const nextIndex =
      body.orderIndex ??
      Number(
        (ctx.db.prepare('SELECT COALESCE(MAX(order_index) + 1, 0) AS n FROM tasks WHERE event_id = ?').get(event.id) as Row)['n'],
      );

    const id = randomUUID();
    ctx.db
      .prepare(
        `INSERT INTO tasks (id, event_id, order_index, title, description, code, points, verification, lat, lng, radius_m, quality_enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        event.id,
        nextIndex,
        body.title,
        body.description,
        body.code === null ? null : normalizeCode(body.code),
        body.points,
        body.verification,
        body.lat,
        body.lng,
        body.radiusM,
        body.qualityEnabled ? 1 : 0,
        Date.now(),
      );

    ensureQualityCodes(ctx, event.id, body.qualityEnabled);
    ctx.hub.publish(event.id, { type: 'tasks-changed' });
    res.status(201).json(rowToAdminTask(ctx.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row));
  });

  router.put('/events/:slug/tasks/:taskId', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const body = TaskUpsert.parse(req.body);
    const existing = ctx.db.prepare('SELECT * FROM tasks WHERE id = ? AND event_id = ?').get(req.params.taskId, event.id);
    if (!existing) throw notFound('Задание не найдено');

    ctx.db
      .prepare(
        `UPDATE tasks SET title = ?, description = ?, code = ?, points = ?, verification = ?,
                          lat = ?, lng = ?, radius_m = ?, quality_enabled = ?, order_index = COALESCE(?, order_index)
         WHERE id = ?`,
      )
      .run(
        body.title,
        body.description,
        body.code === null ? null : normalizeCode(body.code),
        body.points,
        body.verification,
        body.lat,
        body.lng,
        body.radiusM,
        body.qualityEnabled ? 1 : 0,
        body.orderIndex ?? null,
        req.params.taskId,
      );

    ensureQualityCodes(ctx, event.id, body.qualityEnabled);
    ctx.hub.publish(event.id, { type: 'tasks-changed' });
    res.json(rowToAdminTask(ctx.db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId) as Row));
  });

  router.delete('/events/:slug/tasks/:taskId', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    ctx.db.prepare('DELETE FROM tasks WHERE id = ? AND event_id = ?').run(req.params.taskId, event.id);
    ctx.hub.publish(event.id, { type: 'tasks-changed' });
    res.status(204).end();
  });

  router.get('/events/:slug/players', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const rows = ctx.db
      .prepare(
        `SELECT p.*, t.name AS team_name
         FROM players p JOIN teams t ON t.id = p.team_id
         WHERE p.event_id = ? ORDER BY t.name, p.name`,
      )
      .all(event.id) as Row[];
    res.json(rows.map((row) => ({ ...rowToPlayer(row), teamName: String(row['team_name']) })));
  });

  /** Организатор видит табло всегда, включая идущую игру. */
  router.get('/events/:slug/scoreboard', (req, res) => {
    res.json(buildScoreboard(ctx, findEventBySlug(ctx, req.params.slug).id));
  });

  /** Архив прошедших игр: снимки итогов, переживающие сброс. */
  router.get('/archives', (_req, res) => {
    res.json(listArchives(ctx));
  });

  router.get('/events/:slug/quality-codes', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const rows = ctx.db.prepare('SELECT * FROM quality_codes WHERE event_id = ? ORDER BY points DESC').all(event.id) as Row[];
    res.json(rows.map(rowToQualityCode));
  });

  /**
   * Журнал попыток. Подряд идущие отказы у одной команды — признак перебора,
   * одинаковый код у команд в разных концах города — признак утечки в общий чат.
   */
  router.get('/events/:slug/attempts', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const limit = Math.min(Number(req.query['limit'] ?? 200), 1000);
    const rows = ctx.db
      .prepare(
        `SELECT a.*, t.name AS team_name, p.name AS player_name
         FROM attempt_log a
         JOIN teams t ON t.id = a.team_id
         JOIN players p ON p.id = a.player_id
         WHERE a.event_id = ? ORDER BY a.created_at DESC LIMIT ?`,
      )
      .all(event.id, limit) as Row[];

    res.json(
      rows.map((row) => ({
        id: String(row['id']),
        teamName: String(row['team_name']),
        playerName: String(row['player_name']),
        value: String(row['value']),
        ok: Number(row['ok']) === 1,
        reason: row['reason'] === null ? null : String(row['reason']),
        createdAt: Number(row['created_at']),
      })),
    );
  });

  /** Выгрузка итогов в CSV — организаторы печатают её на награждении. */
  router.get('/events/:slug/export.csv', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const { rows } = buildScoreboard(ctx, event.id);
    const header = 'place,team,solved,task_points,quality_points,total';
    const body = rows.map((row, index) =>
      [index + 1, csvCell(row.teamName), row.solvedCount, row.taskPoints, row.qualityPoints, row.totalPoints].join(','),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${event.slug}-results.csv"`);
    res.send([header, ...body].join('\n'));
  });

  return router;
}

/** Три постоянных кода качества создаются при первом включении опции в любом задании. */
function ensureQualityCodes(ctx: AppContext, eventId: string, enabled: boolean): void {
  if (!enabled) return;
  const existing = ctx.db.prepare('SELECT COUNT(*) AS n FROM quality_codes WHERE event_id = ?').get(eventId) as Row;
  if (Number(existing['n']) > 0) return;

  const insert = ctx.db.prepare('INSERT INTO quality_codes (id, event_id, code, points, label) VALUES (?, ?, ?, ?, ?)');
  for (const qc of [
    { code: 'КАЧ10', points: 10, label: 'Отлично' },
    { code: 'КАЧ5', points: 5, label: 'Хорошо' },
    { code: 'КАЧ3', points: 3, label: 'Удовлетворительно' },
  ]) {
    insert.run(randomUUID(), eventId, qc.code, qc.points, qc.label);
  }
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
