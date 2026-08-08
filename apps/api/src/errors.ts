import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod/v4';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Требуется токен игрока') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Недостаточно прав') => new HttpError(403, 'forbidden', message);
export const notFound = (message: string) => new HttpError(404, 'not_found', message);
export const conflict = (message: string) => new HttpError(409, 'conflict', message);
export const tooManyRequests = (message: string) => new HttpError(429, 'rate_limited', message);

/** Единый формат ошибки — клиенты (web и mobile) разбирают только его. */
export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation_failed', message: 'Тело запроса не прошло валидацию', details: error.issues },
    });
    return;
  }

  console.error('[api] необработанная ошибка:', error);
  res.status(500).json({ error: { code: 'internal_error', message: 'Внутренняя ошибка сервера' } });
}
