import { createApp } from './app.ts';
import { createContext } from './context.ts';
import { startAutoFinish } from './services/events.ts';

const port = Number(process.env['PORT'] ?? 8080);
const ctx = createContext();
const app = createApp(ctx);

// Игра заканчивается по часам, а не по запросу: без этой проверки истёкший
// квест остался бы в статусе «идёт», пока кто-нибудь не дёрнет API.
const stopAutoFinish = startAutoFinish(ctx);

const server = app.listen(port, () => {
  console.log(`[api] слушает http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} — завершаюсь`);
    stopAutoFinish();
    ctx.hub.closeAll();
    server.close(() => {
      ctx.db.close();
      process.exit(0);
    });
  });
}
