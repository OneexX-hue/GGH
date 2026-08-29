import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Player } from '@workspace/core';
import { rowToPlayer } from '@workspace/db';
import type { AppContext } from './context.ts';
import { forbidden, unauthorized } from './errors.ts';

/**
 * Токен игрока выдаётся один раз при регистрации и больше не покидает сервер:
 * в базе лежит только SHA-256. Утечка дампа БД не даёт войти за игрока.
 */
export function issueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function bearer(req: Request): string | null {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function requirePlayer(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearer(req);
    if (!token) {
      next(unauthorized());
      return;
    }

    const row = ctx.db.prepare('SELECT * FROM players WHERE token_hash = ?').get(hashToken(token)) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      next(unauthorized('Токен не найден — зарегистрируйтесь заново'));
      return;
    }

    req.player = rowToPlayer(row);
    // last_seen_at нужен админу, чтобы видеть, кто из команд ещё на связи.
    ctx.db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').run(Date.now(), req.player.id);
    next();
  };
}

/**
 * Админка защищена общим секретом из ADMIN_TOKEN.
 * Сравнение постоянного времени — иначе токен подбирается по времени ответа.
 */
export function requireAdmin(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const provided = req.get('x-admin-token') ?? bearer(req) ?? '';
    if (!constantTimeEqual(provided, ctx.adminToken)) {
      next(forbidden('Неверный админский токен'));
      return;
    }
    next();
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  // Хешируем, чтобы сравнивать буферы одинаковой длины: сама длина секрета не утекает.
  const bufA = createHash('sha256').update(a).digest();
  const bufB = createHash('sha256').update(b).digest();
  return timingSafeEqual(bufA, bufB) && a.length > 0;
}
