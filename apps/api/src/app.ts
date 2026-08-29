import express, { type Express } from 'express';
import type { AppContext } from './context.ts';
import { errorHandler, notFound } from './errors.ts';
import { adminRouter } from './routes/admin.ts';
import { gameRouter } from './routes/game.ts';
import { playersRouter } from './routes/players.ts';

export function createApp(ctx: AppContext): Express {
  const app = express();

  app.use(express.json({ limit: '256kb' }));
  app.use(cors());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: Date.now() });
  });

  app.use('/api', playersRouter(ctx));
  app.use('/api', gameRouter(ctx));
  app.use('/api/admin', adminRouter(ctx));

  app.use((req, _res, next) => {
    next(notFound(`Маршрут ${req.method} ${req.path} не существует`));
  });
  app.use(errorHandler);

  return app;
}

/**
 * CORS вручную, без зависимости: мобильное приложение шлёт запросы с origin `null`,
 * а веб — с localhost:21234 в разработке и со своего домена в проде.
 * Список источников задаётся через ALLOWED_ORIGINS; по умолчанию разрешено всё,
 * что уместно для API без cookie-сессий (токен передаётся заголовком).
 */
function cors(): express.RequestHandler {
  const allowed = (process.env['ALLOWED_ORIGINS'] ?? '*').split(',').map((s) => s.trim());
  const allowAll = allowed.includes('*');

  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && (allowAll || allowed.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (allowAll) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
