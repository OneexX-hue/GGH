import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OfflineQueue, memoryStorage } from './offline-queue.ts';

interface Payload {
  code: string;
}

test('повторная постановка с тем же ключом не дублирует попытку', async () => {
  const queue = new OfflineQueue<Payload>(memoryStorage());
  await queue.enqueue({ code: 'A' }, 'key-1');
  await queue.enqueue({ code: 'A' }, 'key-1');
  assert.equal(await queue.size(), 1);
});

test('flush отправляет в порядке добавления и очищает очередь', async () => {
  const queue = new OfflineQueue<Payload>(memoryStorage());
  await queue.enqueue({ code: 'A' }, 'k1');
  await queue.enqueue({ code: 'B' }, 'k2');

  const seen: string[] = [];
  const result = await queue.flush(async (payload) => {
    seen.push(payload.code);
  });

  assert.deepEqual(seen, ['A', 'B']);
  assert.deepEqual(result, { sent: 2, failed: 0, remaining: 0 });
  assert.equal(await queue.size(), 0);
});

test('сетевая ошибка оставляет попытку в очереди до следующего раза', async () => {
  const queue = new OfflineQueue<Payload>(memoryStorage());
  await queue.enqueue({ code: 'A' }, 'k1');

  const offline = await queue.flush(async () => {
    throw new Error('network down');
  });
  assert.deepEqual(offline, { sent: 0, failed: 1, remaining: 1 });

  const online = await queue.flush(async () => {});
  assert.equal(online.sent, 1);
  assert.equal(await queue.size(), 0);
});

test('безнадёжная попытка выбрасывается после лимита попыток', async () => {
  const queue = new OfflineQueue<Payload>(memoryStorage());
  await queue.enqueue({ code: 'A' }, 'k1');

  for (let i = 0; i < 8; i++) {
    await queue.flush(async () => {
      throw new Error('nope');
    });
  }
  assert.equal(await queue.size(), 0, 'очередь не должна расти бесконечно');
});

test('очередь переживает перезапуск приложения', async () => {
  const storage = memoryStorage();
  const first = new OfflineQueue<Payload>(storage);
  await first.enqueue({ code: 'A' }, 'k1');

  const afterRestart = new OfflineQueue<Payload>(storage);
  assert.equal(await afterRestart.size(), 1);
});

test('повреждённое хранилище не роняет очередь', async () => {
  const storage = memoryStorage();
  await storage.setItem('quest:submission-queue:v1', '{not json');
  const queue = new OfflineQueue<Payload>(storage);
  assert.equal(await queue.size(), 0);
});

test('параллельные flush не отправляют одно и то же дважды', async () => {
  const queue = new OfflineQueue<Payload>(memoryStorage());
  await queue.enqueue({ code: 'A' }, 'k1');

  let calls = 0;
  const send = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 10));
  };
  await Promise.all([queue.flush(send), queue.flush(send)]);
  assert.equal(calls, 1);
});
