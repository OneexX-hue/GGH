import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { createContext } from './context.ts';
import type { AppContext } from './context.ts';

const ADMIN = 'test-admin-token';
let ctx: AppContext;
let server: Server;
let base: string;

before(async () => {
  ctx = createContext({ dbPath: ':memory:', adminToken: ADMIN, seed: true });
  server = createApp(ctx).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  ctx.hub.closeAll();
  await new Promise((resolve) => server.close(resolve));
});

/* ------------------------------------------------------------- помощники */

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

const adminHeaders = { 'X-Admin-Token': ADMIN };

/** Тело читается ровно один раз — иначе второе чтение падает с 'Body has already been read'. */
async function expectStatus<T>(res: Response, status: number): Promise<T> {
  const text = await res.text();
  assert.equal(res.status, status, text);
  return JSON.parse(text) as T;
}

async function register(playerName: string, teamName: string) {
  const res = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ eventSlug: 'city-quest', playerName, teamName, deviceId: randomUUID() }),
  });
  return expectStatus<{ token: string; player: { id: string }; team: { id: string } }>(res, 201);
}

async function command(action: string, extra: Record<string, unknown> = {}) {
  const res = await api('/api/admin/events/city-quest/command', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action, ...extra }),
  });
  await expectStatus(res, 200);
}

async function submit(token: string, taskId: string, code: string, extra: Record<string, unknown> = {}) {
  const res = await api('/api/submissions/code', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId, code, idempotencyKey: randomUUID(), ...extra }),
  });
  return (await res.json()) as { status: string; reason: string | null; distanceM: number | null };
}

/* ---------------------------------------------------------------- тесты */

test('health отвечает и отдаёт время сервера', async () => {
  const res = await api('/health');
  const body = (await res.json()) as { status: string; serverTime: number };
  assert.equal(body.status, 'ok');
  assert.ok(body.serverTime > 0);
});

test('база засеяна десятью заданиями', async () => {
  const res = await api('/api/admin/events/city-quest/tasks', { headers: adminHeaders });
  const tasks = (await res.json()) as unknown[];
  assert.equal(tasks.length, 10);
});

test('админка закрыта без токена', async () => {
  const res = await api('/api/admin/events');
  assert.equal(res.status, 403);
});

test('игрок не видит коды заданий', async () => {
  const { token } = await register('Аня', 'Совы');
  const res = await api('/api/tasks', { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { tasks: Record<string, unknown>[] };
  assert.ok(body.tasks.length > 0);
  for (const task of body.tasks) {
    assert.ok(!('code' in task), 'ответ задания не должен уходить на клиент');
  }
});

test('запрос без токена отклоняется', async () => {
  const res = await api('/api/tasks');
  assert.equal(res.status, 401);
});

test('коды не принимаются, пока игра не запущена', async () => {
  const { token } = await register('Боря', 'Ежи');
  const tasks = await adminTasks();
  const result = await submit(token, tasks[0]!.id, tasks[0]!.code!);
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'game_not_running');
});

test('полный цикл: старт, верный код, баллы, повтор не удваивает', async () => {
  const { token, team } = await register('Вера', 'Лисы');
  const tasks = await adminTasks();
  await command('start');

  const ok = await submit(token, tasks[0]!.id, tasks[0]!.code!);
  assert.equal(ok.status, 'accepted');
  // Игроку баллы не показываются до итогов, поэтому сумму проверяем у организатора.
  assert.equal(await teamPoints(team.id), tasks[0]!.points);

  const again = await submit(token, tasks[0]!.id, tasks[0]!.code!);
  assert.equal(again.status, 'rejected');
  assert.equal(again.reason, 'already_solved');
  assert.equal(await teamPoints(team.id), tasks[0]!.points, 'сумма не должна вырасти');
});

test('код нечувствителен к регистру и пробелам', async () => {
  const { token } = await register('Гриша', 'Волки');
  const tasks = await adminTasks();
  const result = await submit(token, tasks[2]!.id, ` ${tasks[2]!.code!.toLowerCase()} `);
  assert.equal(result.status, 'accepted');
});

test('неверный код отклоняется без начисления', async () => {
  const { token, team } = await register('Дима', 'Барсуки');
  const tasks = await adminTasks();
  const result = await submit(token, tasks[1]!.id, 'ЧУШЬ');
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'wrong_code');
  assert.equal(await teamPoints(team.id), 0);
});

test('повтор с тем же ключом идемпотентности начисляет один раз', async () => {
  const { token, team } = await register('Женя', 'Куницы');
  const tasks = await adminTasks();
  const body = JSON.stringify({ taskId: tasks[3]!.id, code: tasks[3]!.code, idempotencyKey: randomUUID() });
  const headers = { Authorization: `Bearer ${token}` };

  await api('/api/submissions/code', { method: 'POST', headers, body });
  const afterFirst = await teamPoints(team.id);

  const second = (await (await api('/api/submissions/code', { method: 'POST', headers, body })).json()) as {
    status: string;
  };

  assert.equal(second.status, 'accepted');
  assert.equal(await teamPoints(team.id), afterFirst, 'офлайн-очередь не должна удваивать баллы');
});

test('на паузе коды не принимаются, после снятия — снова принимаются', async () => {
  const { token } = await register('Зина', 'Рыси');
  const tasks = await adminTasks();

  await command('pause');
  const paused = await submit(token, tasks[4]!.id, tasks[4]!.code!);
  assert.equal(paused.reason, 'game_not_running');

  await command('resume');
  const resumed = await submit(token, tasks[4]!.id, tasks[4]!.code!);
  assert.equal(resumed.status, 'accepted');
});

test('таймер не съедается паузой', async () => {
  const before = (await (await api('/api/events/city-quest/state')).json()) as { remainingMs: number };
  await command('pause');
  await new Promise((r) => setTimeout(r, 60));
  await command('resume');
  const after = (await (await api('/api/events/city-quest/state')).json()) as { remainingMs: number };
  // Остаток мог уменьшиться только на время работы теста, но не на длину паузы.
  assert.ok(before.remainingMs - after.remainingMs < 60, 'пауза не должна расходовать игровое время');
});

test('гео-проверка не пускает издалека и пускает на точке', async () => {
  const create = await api('/api/admin/events/city-quest/tasks', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Точка на карте',
      description: '',
      code: 'ГЕО',
      points: 50,
      lat: 55.7558,
      lng: 37.6173,
      radiusM: 100,
    }),
  });
  const task = (await create.json()) as { id: string };
  const { token } = await register('Игорь', 'Тигры');

  const far = await submit(token, task.id, 'ГЕО', { coords: { lat: 55.9, lng: 37.6173 } });
  assert.equal(far.reason, 'too_far');

  const near = await submit(token, task.id, 'ГЕО', { coords: { lat: 55.7558, lng: 37.6174 } });
  assert.equal(near.status, 'accepted');
});

test('коды качества засчитываются один раз на задание', async () => {
  const { token, team } = await register('Катя', 'Соколы');
  const tasks = await adminTasks();
  const headers = { Authorization: `Bearer ${token}` };
  const claim = (extra: Record<string, unknown>) =>
    api('/api/submissions/quality', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: 'КАЧ10', taskId: tasks[1]!.id, idempotencyKey: randomUUID(), ...extra }),
    }).then((r) => r.json() as Promise<{ status: string; reason: string | null }>);

  const first = await claim({});
  assert.equal(first.status, 'accepted');
  assert.ok(!('pointsAwarded' in first), 'баллов в ответе игроку быть не должно');
  assert.equal(await teamPoints(team.id), 10);

  const second = await claim({});
  assert.equal(second.reason, 'already_solved');
  assert.equal(await teamPoints(team.id), 10, 'повторная оценка не должна начислять снова');
});

test('перебор кодов упирается в лимит попыток', async () => {
  const { token } = await register('Лёша', 'Барракуды');
  const tasks = await adminTasks();
  const reasons: (string | null)[] = [];
  for (let i = 0; i < 15; i++) {
    reasons.push((await submit(token, tasks[5]!.id, `ПОПЫТКА${i}`)).reason);
  }
  assert.ok(reasons.includes('rate_limited'), 'после серии неверных кодов должен включиться лимит');
});

test('публичного табло не существует', async () => {
  const res = await api('/api/events/city-quest/scoreboard');
  assert.equal(res.status, 404, 'счёт и места доступны только организатору');
});

test('организатор видит табло во время игры', async () => {
  const board = (await (await api('/api/admin/events/city-quest/scoreboard', { headers: adminHeaders })).json()) as {
    rows: { totalPoints: number }[];
  };
  assert.ok(board.rows.length > 1);
  for (let i = 1; i < board.rows.length; i++) {
    assert.ok(board.rows[i - 1]!.totalPoints >= board.rows[i]!.totalPoints, 'табло должно быть отсортировано');
  }
});

test('в ответах игроку нет никаких баллов', async () => {
  const { token } = await register('Надя', 'Выдры');
  const headers = { Authorization: `Bearer ${token}` };
  const tasks = await adminTasks();

  const accepted = await submit(token, tasks[8]!.id, tasks[8]!.code!);
  assert.equal(accepted.status, 'accepted');
  assert.ok(!('pointsAwarded' in accepted), 'начисленных баллов в ответе быть не должно');
  assert.ok(!('totalPoints' in accepted), 'суммы команды в ответе быть не должно');

  const body = (await (await api('/api/tasks', { headers })).json()) as {
    tasks: { solved: boolean; points: number | null }[];
  };
  assert.ok(!('totalPoints' in body), 'список заданий не должен нести сумму команды');

  const solvedTask = body.tasks.find((t) => t.solved);
  assert.ok(solvedTask, 'задание должно быть отмечено сданным');
  assert.equal(solvedTask.points, null, 'номинал сданного задания раскрыл бы заработанные баллы');
  assert.ok(
    body.tasks.some((t) => !t.solved && t.points !== null),
    'у несданных заданий номинал остаётся — он нужен для выбора маршрута',
  );
});

test('после «Стоп» игроку по-прежнему не видно ни счёта, ни табло', async () => {
  const { token } = await register('Олег', 'Совы-2');
  await command('stop');

  const state = (await (await api('/api/events/city-quest/state')).json()) as { event: { status: string } };
  assert.equal(state.event.status, 'finished');

  assert.equal((await api('/api/events/city-quest/scoreboard')).status, 404, 'публичного табло нет и после игры');

  const body = (await (await api('/api/tasks', { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    tasks: { solved: boolean; points: number | null }[];
  };
  assert.ok(!('totalPoints' in body), 'сумма не появляется и после завершения игры');
  assert.ok(
    body.tasks.filter((t) => t.solved).every((t) => t.points === null),
    'номинал сданных заданий остаётся скрытым и после игры',
  );

  // Организатор при этом видит всё.
  const board = (await (await api('/api/admin/events/city-quest/scoreboard', { headers: adminHeaders })).json()) as {
    rows: unknown[];
  };
  assert.ok(board.rows.length > 0);
});

test('завершённую игру нельзя остановить или запустить повторно', async () => {
  for (const action of ['stop', 'start']) {
    const res = await api('/api/admin/events/city-quest/command', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ action }),
    });
    assert.equal(res.status, 400, `${action} на завершённой игре должен отклоняться`);
  }
});

test('сброс без подтверждения названием отклоняется', async () => {
  const res = await api('/api/admin/events/city-quest/command', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'reset' }),
  });
  assert.equal(res.status, 400);

  const wrong = await api('/api/admin/events/city-quest/command', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'reset', confirmation: 'не то название' }),
  });
  assert.equal(wrong.status, 400);

  // Результаты на месте.
  const board = (await (await api('/api/admin/events/city-quest/scoreboard', { headers: adminHeaders })).json()) as {
    rows: unknown[];
  };
  assert.ok(board.rows.length > 0, 'отклонённый сброс не должен ничего удалять');
});

test('итоги уходят в архив и переживают сброс', async () => {
  const before = (await (await api('/api/admin/events/city-quest/scoreboard', { headers: adminHeaders })).json()) as {
    rows: { teamName: string; totalPoints: number }[];
  };

  await command('reset', { confirmation: 'Городской квест' });

  const after = (await (await api('/api/admin/events/city-quest/scoreboard', { headers: adminHeaders })).json()) as {
    rows: { totalPoints: number }[];
  };
  assert.ok(
    after.rows.every((row) => row.totalPoints === 0),
    'после сброса результаты обнулены',
  );

  const archives = (await (await api('/api/admin/archives', { headers: adminHeaders })).json()) as {
    reason: string;
    teamCount: number;
    rows: { teamName: string; totalPoints: number }[];
  }[];
  assert.ok(archives.length > 0, 'снимок итогов должен сохраниться');

  const finalSnapshot = archives.find((a) => a.reason === 'finished');
  assert.ok(finalSnapshot, 'при завершении игры пишется снимок');
  assert.deepEqual(
    finalSnapshot.rows.map((r) => [r.teamName, r.totalPoints]),
    before.rows.map((r) => [r.teamName, r.totalPoints]),
    'архив должен совпадать с табло на момент финала',
  );
});

test('повторная регистрация с тем же устройством возвращает того же игрока', async () => {
  const deviceId = randomUUID();
  const body = JSON.stringify({ eventSlug: 'city-quest', playerName: 'Миша', teamName: 'Пумы', deviceId });
  const first = (await (await api('/api/register', { method: 'POST', body })).json()) as { player: { id: string } };
  const second = (await (await api('/api/register', { method: 'POST', body })).json()) as {
    player: { id: string };
    token: string;
  };

  assert.equal(second.player.id, first.player.id, 'переустановка приложения не должна терять прогресс');
  const me = await api('/api/me', { headers: { Authorization: `Bearer ${second.token}` } });
  assert.equal(me.status, 200);
});

test('CSV-выгрузка отдаётся с заголовком', async () => {
  const res = await api('/api/admin/events/city-quest/export.csv', { headers: adminHeaders });
  const text = await res.text();
  assert.match(res.headers.get('content-type') ?? '', /text\/csv/);
  assert.ok(text.startsWith('place,team,solved'));
});

test('несуществующий маршрут — 404 в общем формате ошибки', async () => {
  const res = await api('/api/нет-такого');
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'not_found');
});

// Ставится последним: тест оставляет игру завершённой, что закрывает регистрацию.
test('игра завершается сама, когда вышло время', async () => {
  await command('start', { durationMs: 1000 });

  const running = (await (await api('/api/events/city-quest/state')).json()) as { event: { status: string } };
  assert.equal(running.event.status, 'running');

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const expired = (await (await api('/api/events/city-quest/state')).json()) as {
    event: { status: string };
    remainingMs: number;
  };
  assert.equal(expired.event.status, 'finished', 'истёкшая игра не должна оставаться в статусе running');
  assert.equal(expired.remainingMs, 0);
});

test('после конца времени регистрация закрыта', async () => {
  const res = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      eventSlug: 'city-quest',
      playerName: 'Поздний',
      teamName: 'Опоздавшие',
      deviceId: randomUUID(),
    }),
  });
  assert.equal(res.status, 409);
});

/** Сумма баллов команды глазами организатора — единственный источник чисел во время игры. */
async function teamPoints(teamId: string): Promise<number> {
  const board = (await (await api('/api/admin/events/city-quest/scoreboard', { headers: adminHeaders })).json()) as {
    rows: { teamId: string; totalPoints: number }[];
  };
  return board.rows.find((row) => row.teamId === teamId)?.totalPoints ?? 0;
}

async function adminTasks(): Promise<{ id: string; code: string | null; points: number }[]> {
  const res = await api('/api/admin/events/city-quest/tasks', { headers: adminHeaders });
  return (await res.json()) as { id: string; code: string | null; points: number }[];
}
