import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // WebRTC-сигнализация (backend/src/calls) — обычный ws, не socket.io,
  // см. docs/DECISIONS.md, "WebRTC-звонки — архитектура".
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors();
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`CarClub backend listening on :${port}`);
}

bootstrap();
