import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { RegisterRequest } from '@workspace/core';
import { rowToPlayer, rowToTeam } from '@workspace/db';
import { issueToken, requirePlayer } from '../auth.ts';
import type { AppContext } from '../context.ts';
import { conflict } from '../errors.ts';
import { findEventBySlug } from '../services/events.ts';

type Row = Record<string, unknown>;

export function playersRouter(ctx: AppContext): Router {
  const router = Router();

  /**
   * Регистрация. Возвращает токен — единственный раз за всю жизнь игрока.
   *
   * Повторный вызов с тем же deviceId не создаёт второго игрока, а выдаёт новый
   * токен существующему: игрок переустановил приложение и должен вернуться
   * в свою команду со своим прогрессом, а не начать с нуля.
   */
  router.post('/register', (req, res) => {
    const body = RegisterRequest.parse(req.body);
    const event = findEventBySlug(ctx, body.eventSlug);
    const now = Date.now();

    const existing = ctx.db
      .prepare('SELECT * FROM players WHERE event_id = ? AND device_id = ?')
      .get(event.id, body.deviceId) as Row | undefined;

    if (existing) {
      const { token, hash } = issueToken();
      ctx.db.prepare('UPDATE players SET token_hash = ?, name = ?, last_seen_at = ? WHERE id = ?').run(hash, body.playerName, now, String(existing['id']));
      const player = rowToPlayer(
        ctx.db.prepare('SELECT * FROM players WHERE id = ?').get(String(existing['id'])) as Row,
      );
      const team = rowToTeam(ctx.db.prepare('SELECT * FROM teams WHERE id = ?').get(player.teamId) as Row);
      res.json({ token, player, team });
      return;
    }

    if (event.status === 'finished') throw conflict('Игра уже завершена, регистрация закрыта');

    // Команда с таким названием может уже существовать — тогда игрок вступает в неё.
    const teamRow = ctx.db.prepare('SELECT * FROM teams WHERE event_id = ? AND name = ?').get(event.id, body.teamName) as
      | Row
      | undefined;
    let teamId: string;
    if (teamRow) {
      teamId = String(teamRow['id']);
    } else {
      teamId = randomUUID();
      ctx.db
        .prepare('INSERT INTO teams (id, event_id, name, created_at) VALUES (?, ?, ?, ?)')
        .run(teamId, event.id, body.teamName, now);
    }

    const { token, hash } = issueToken();
    const playerId = randomUUID();
    ctx.db
      .prepare(
        `INSERT INTO players (id, event_id, team_id, name, role, token_hash, device_id, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, 'player', ?, ?, ?, ?)`,
      )
      .run(playerId, event.id, teamId, body.playerName, hash, body.deviceId, now, now);

    const player = rowToPlayer(ctx.db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as Row);
    const team = rowToTeam(ctx.db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as Row);
    res.status(201).json({ token, player, team });
  });

  /** Проверка токена при запуске приложения: жив ли он ещё. */
  router.get('/me', requirePlayer(ctx), (req, res) => {
    const player = req.player!;
    const team = rowToTeam(ctx.db.prepare('SELECT * FROM teams WHERE id = ?').get(player.teamId) as Row);
    res.json({ player, team });
  });

  return router;
}
