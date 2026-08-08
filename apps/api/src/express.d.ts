import type { Player } from '@workspace/core';

/**
 * Расширение Request: requirePlayer кладёт сюда игрока, проверенного по токену.
 * Поле опционально — обработчики за middleware обращаются к нему через `!`.
 */
declare global {
  namespace Express {
    interface Request {
      player?: Player;
    }
  }
}

export {};
