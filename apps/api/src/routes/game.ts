import { Router } from 'express';
import { rowToQualityCode, rowToTask } from '@workspace/db';
import { requirePlayer } from '../auth.ts';
import type { AppContext } from '../context.ts';
import { findEventById, findEventBySlug, toGameState } from '../services/events.ts';
import { buildScoreboard, solvedTaskIds, teamTotal } from '../services/scoring.ts';
import { claimQuality, submitCode } from '../services/submissions.ts';
import { ClaimQualityRequest, SubmitCodeRequest } from '@workspace/core';

type Row = Record<string, unknown>;

export function gameRouter(ctx: AppContext): Router {
  const router = Router();
  const auth = requirePlayer(ctx);

  /** Состояние игры по slug — доступно без токена, чтобы показать таймер на экране регистрации. */
  router.get('/events/:slug/state', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    res.json(toGameState(event));
  });

  router.get('/events/:slug/scoreboard', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    res.json(buildScoreboard(ctx, event.id));
  });

  /**
   * Поток изменений. Клиент подписывается один раз и перестаёт опрашивать сервер:
   * на игре с сотней устройств опрос раз в секунду это лишние 100 rps на ровном месте.
   */
  router.get('/events/:slug/stream', (req, res) => {
    const event = findEventBySlug(ctx, req.params.slug);
    const unsubscribe = ctx.hub.subscribe(event.id, res);
    req.on('close', unsubscribe);
  });

  router.get('/game-state', auth, (req, res) => {
    res.json(toGameState(findEventById(ctx, req.player!.eventId)));
  });

  /** Список заданий для игрока: без кодов, но с отметкой «уже сдано». */
  router.get('/tasks', auth, (req, res) => {
    const player = req.player!;
    const solved = new Set(solvedTaskIds(ctx, player.teamId));
    const claimed = new Set(
      (ctx.db.prepare('SELECT task_id FROM quality_claims WHERE team_id = ?').all(player.teamId) as Row[]).map((r) =>
        String(r['task_id']),
      ),
    );

    const tasks = (
      ctx.db.prepare('SELECT * FROM tasks WHERE event_id = ? ORDER BY order_index').all(player.eventId) as Row[]
    ).map((row) => {
      const task = rowToTask(row);
      return { ...task, solved: solved.has(task.id), qualityClaimed: claimed.has(task.id) };
    });

    res.json({ tasks, totalPoints: teamTotal(ctx, player.teamId), serverTime: Date.now() });
  });

  router.get('/quality-codes', auth, (req, res) => {
    // Игроку отдаём только баллы и подписи: сами коды печатает организатор.
    const rows = ctx.db.prepare('SELECT * FROM quality_codes WHERE event_id = ?').all(req.player!.eventId) as Row[];
    res.json(rows.map(rowToQualityCode).map(({ id, points, label }) => ({ id, points, label })));
  });

  router.post('/submissions/code', auth, (req, res) => {
    res.json(submitCode(ctx, req.player!, SubmitCodeRequest.parse(req.body)));
  });

  router.post('/submissions/quality', auth, (req, res) => {
    res.json(claimQuality(ctx, req.player!, ClaimQualityRequest.parse(req.body)));
  });

  return router;
}
