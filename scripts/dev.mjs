#!/usr/bin/env node
/**
 * Запуск всей платформы одной командой: `pnpm run dev`.
 *
 * Поднимает API и веб вместе, печатает адреса и админский токен. Отдельно
 * показывает адрес в локальной сети — по нему квест открывается с телефона,
 * подключённого к тому же Wi-Fi, что и компьютер. Это единственный способ
 * проверить игру так, как её увидят участники: с телефона, на ходу.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const API_PORT = process.env['PORT'] ?? '8080';
const WEB_PORT = '21234';
// Сервер намеренно не стартует без ADMIN_TOKEN. Для разработки подставляем
// заведомо несекретное значение — в проде переменную задаёт окружение.
const ADMIN_TOKEN = process.env['ADMIN_TOKEN'] ?? 'dev-secret';

/** Первый адрес IPv4 не-loopback интерфейса — по нему в игру заходят с телефона. */
function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

const children = [];

const isWindows = process.platform === 'win32';

function start(name, args, env = {}) {
  const child = spawn('pnpm', args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    // Своя группа процессов. pnpm запускает vite и tsx внуками, и сигнал,
    // посланный только pnpm, до них не доходит — серверы остаются висеть
    // и держать порты, из-за чего следующий запуск падает «port in use».
    // Убивать надо всю группу целиком.
    detached: !isWindows,
  });

  const prefix = `[${name}]`;
  const relay = (stream, target) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim() !== '') target.write(`${prefix} ${line}\n`);
    });
  };
  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);

  child.on('exit', (code) => {
    // Если один процесс упал, второй без него бесполезен — гасим всё.
    if (code !== 0 && code !== null) {
      console.error(`${prefix} завершился с кодом ${code}, останавливаю остальное`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.pid === undefined || child.exitCode !== null) continue;
    try {
      // Отрицательный pid — сигнал всей группе, вместе с внуками.
      if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Процесс уже умер сам — это не повод шуметь при выходе.
    }
  }

  setTimeout(() => process.exit(code), 500);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));

start('api', ['--filter', '@workspace/api-server', 'run', 'dev'], {
  ADMIN_TOKEN,
  PORT: API_PORT,
});
start('web', ['--filter', '@workspace/quest', 'run', 'dev']);

const lan = lanAddress();
setTimeout(() => {
  const line = '─'.repeat(58);
  console.log(`
${line}
  КВЕСТ ПЛАТФОРМА

  Игроки        http://localhost:${WEB_PORT}
  Организатор   http://localhost:${WEB_PORT}/admin
  API           http://localhost:${API_PORT}

  Токен организатора:  ${ADMIN_TOKEN}
${
  lan
    ? `
  С телефона в том же Wi-Fi:
  Игроки        http://${lan}:${WEB_PORT}
  Организатор   http://${lan}:${WEB_PORT}/admin
`
    : `
  Адрес в локальной сети не найден — с телефона зайти не выйдет.
`
}
  Коды заданий видны в панели организатора.
  Ctrl+C — остановить всё.
${line}
`);
}, 3000);
