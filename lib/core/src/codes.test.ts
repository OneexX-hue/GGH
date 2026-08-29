import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codesMatch, normalizeCode, parseQrPayload, taskQrPayload } from './codes.ts';

test('нормализация прощает регистр и пробелы', () => {
  assert.equal(normalizeCode('  ab 12 '), 'AB12');
  assert.equal(codesMatch('quest-7', 'QUEST-7'), true);
});

test('латинская E и Ё сводятся к кириллической Е', () => {
  assert.equal(codesMatch('ЛЕВ', 'ЛEВ'), true);
  assert.equal(codesMatch('ЁЛКА', 'ЕЛКА'), true);
});

test('разные коды не совпадают', () => {
  assert.equal(codesMatch('AB12', 'AB13'), false);
});

test('QR round-trip', () => {
  const payload = taskQrPayload('night-quest', 'ab 12');
  assert.deepEqual(parseQrPayload(payload), { eventSlug: 'night-quest', code: 'AB12' });
});

test('чужой QR не разбирается', () => {
  assert.equal(parseQrPayload('https://example.com'), null);
  assert.equal(parseQrPayload('quest://x/code/AB'), null, 'слишком короткий slug');
});
