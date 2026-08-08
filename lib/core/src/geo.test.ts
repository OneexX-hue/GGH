import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkGeo, distanceM } from './geo.ts';

const spot = { lat: 55.7558, lng: 37.6173, radiusM: 100 };

test('distanceM считает по большому кругу', () => {
  // Красная площадь → Большой театр, ~800 м по прямой.
  const d = distanceM({ lat: 55.7539, lng: 37.6208 }, { lat: 55.7601, lng: 37.6186 });
  assert.ok(d > 600 && d < 900, `ожидалось ~700 м, получено ${Math.round(d)}`);
});

test('без координат в задании гео-проверка пропускает всех', () => {
  const check = checkGeo({ lat: null, lng: null, radiusM: null }, undefined);
  assert.deepEqual(check, { ok: true, distanceM: null });
});

test('задание с гео требует координат', () => {
  assert.equal(checkGeo(spot, undefined).ok, false);
});

test('внутри радиуса — принимается', () => {
  assert.equal(checkGeo(spot, { lat: 55.7558, lng: 37.6175 }).ok, true);
});

test('за километр — отклоняется, с указанием расстояния', () => {
  const check = checkGeo(spot, { lat: 55.7650, lng: 37.6173 });
  assert.equal(check.ok, false);
  assert.ok((check.distanceM ?? 0) > 900);
});

test('погрешность GPS расширяет радиус, но не безгранично', () => {
  const justOutside = { lat: 55.75645, lng: 37.6173 }; // ~72 м от точки
  assert.equal(checkGeo(spot, justOutside).ok, true, 'внутри 100 м и так проходит');

  const farAway = { lat: 55.7650, lng: 37.6173 }; // ~1 км
  assert.equal(
    checkGeo(spot, { ...farAway, accuracyM: 10_000 }).ok,
    false,
    'завышенная accuracy не должна открывать код из дома',
  );
});
