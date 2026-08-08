import { createApp } from './app.ts';
import { createContext } from './context.ts';

const port = Number(process.env['PORT'] ?? 8080);
const ctx = createContext();
const app = createApp(ctx);

const server = app.listen(port, () => {
  console.log(`[api] слушает http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} — завершаюсь`);
    ctx.hub.closeAll();
    server.close(() => {
      ctx.db.close();
      process.exit(0);
    });
  });
}
