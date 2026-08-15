// Нагрузочный тест сценария "регистрация → чат → фото" под условный
// масштаб ~5000 участников мероприятия (ТЗ гл. 4, докупить —
// docs/ROADMAP.md, Этап 4). Заготовка для запуска — НЕ прогонялась в
// этой сессии против реального стенда (нужна развёрнутая инфраструктура
// — backend + Postgres + Rocket.Chat, которых в песочнице для нагрузки
// такого масштаба нет). Значения порогов (thresholds) ниже — разумные
// дефолты для API такого типа, не результат реального замера, поправить
// после первого реального прогона.
//
// Лицензия k6: AGPL-3.0 (ядро) — используется как внешний CLI-инструмент,
// не встраивается в продукт, не добавлен ни в один package.json. Разбор
// см. docs/LICENSING.md, раздел "Разрешено с оговорками".
//
// Запуск:
//   1. Развернуть backend + Postgres + Rocket.Chat против тестового
//      стенда (не прод!).
//   2. Создать MULTI_USE инвайт с maxUses >= числу виртуальных
//      пользователей (VUs), которых собираетесь прогнать — обычный
//      TEST-INVITE-0001 из сида рассчитан только на 10 использований.
//      Например через web-admin (/invites) или напрямую в БД.
//   3. Узнать roomId существующей комнаты в Rocket.Chat, куда участники
//      будут постить сообщения (например общий канал клуба).
//   4. k6 run -e BASE_URL=https://staging.carclub.example \
//             -e INVITE_CODE=LOAD-TEST-INVITE \
//             -e RC_ROOM_ID=general \
//             infra/load-test/k6-chat-load.js
//
// Тестовые аккаунты создаются с префиксом TEST-LOAD- в email — легко
// отличить и почистить после прогона, не спутать с реальными ПДн
// (см. CLAUDE.md, "Как работать с этим репозиторием").

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const INVITE_CODE = __ENV.INVITE_CODE || 'TEST-INVITE-0001';
const RC_ROOM_ID = __ENV.RC_ROOM_ID || '';

const testPhoto = open('./fixtures/test-photo.jpg', 'b');

export const options = {
  scenarios: {
    event_peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 }, // приход участников на мероприятие
        { duration: '5m', target: 5000 }, // пиковая нагрузка — ~5000 участников
        { duration: '5m', target: 5000 }, // удержание пика (чат + фото активно)
        { duration: '2m', target: 0 }, // отток
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // менее 1% ошибок
    'http_req_duration{endpoint:register}': ['p(95)<2000'],
    'http_req_duration{endpoint:login}': ['p(95)<1000'],
    'http_req_duration{endpoint:chat_session}': ['p(95)<1000'],
    'http_req_duration{endpoint:media_upload}': ['p(95)<3000'],
  },
};

function uniqueSuffix() {
  return `${__VU}-${__ITER}-${Date.now()}`;
}

function registerParticipant() {
  const suffix = uniqueSuffix();
  const email = `TEST-LOAD-${suffix}@carclub.local`;
  const payload = JSON.stringify({
    inviteCode: INVITE_CODE,
    email,
    password: 'TEST-load-password-123',
    displayName: `Нагрузочный участник ${suffix}`,
  });

  const res = http.post(`${BASE_URL}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'register' },
  });

  check(res, { 'регистрация успешна (201)': (r) => r.status === 201 });

  if (res.status !== 201) return null;
  return JSON.parse(res.body);
}

function fetchChatSession(accessToken) {
  const res = http.post(`${BASE_URL}/chat-bridge/session`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
    tags: { endpoint: 'chat_session' },
  });

  check(res, { 'сессия чата получена (200/201)': (r) => r.status === 200 || r.status === 201 });

  if (res.status !== 200 && res.status !== 201) return null;
  return JSON.parse(res.body);
}

function postChatMessage(session) {
  if (!session || !RC_ROOM_ID) return; // без указанной комнаты пропускаем шаг чата

  const payload = JSON.stringify({ roomId: RC_ROOM_ID, text: 'Привет с нагрузочного теста!' });
  const res = http.post(`${session.baseUrl}/api/v1/chat.postMessage`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': session.authToken,
      'X-User-Id': session.rocketChatUserId,
    },
    tags: { endpoint: 'chat_post_message' },
  });

  check(res, { 'сообщение отправлено (200)': (r) => r.status === 200 });
}

function uploadPhoto(accessToken) {
  const res = http.post(
    `${BASE_URL}/media`,
    { file: http.file(testPhoto, 'test-photo.jpg', 'image/jpeg') },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      tags: { endpoint: 'media_upload' },
    },
  );

  check(res, { 'фото загружено (201)': (r) => r.status === 201 });
}

export default function () {
  const auth = registerParticipant();
  if (!auth) {
    sleep(1);
    return;
  }

  sleep(Math.random() * 2); // участник осматривается перед первым действием

  const session = fetchChatSession(auth.accessToken);
  postChatMessage(session);

  sleep(Math.random() * 3); // фотографирует машину

  uploadPhoto(auth.accessToken);

  sleep(Math.random() * 2);
}
