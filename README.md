# CarClub Platform

Закрытая платформа автоклуба (iOS + Android + Web). См. `docs/TZ.md` для
полного технического задания, `docs/DECISIONS.md` для журнала
архитектурных решений, `docs/ROADMAP.md` для дорожной карты.

## Структура репозитория

```
docs/            ТЗ, решения, лицензии, дорожная карта
backend/         NestJS API (auth, invites, roles, users, module registry, chat-bridge)
web-admin/       Next.js админ-панель
mobile/          Expo (React Native) мобильный клиент
infra/           docker-compose для локальной разработки
```

## Быстрый старт (локальная разработка)

Требуется: Node.js 22+, PostgreSQL 16 (локально или через Docker).

### Backend

```bash
cd backend
cp .env.example .env   # указать DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npx ts-node prisma/seed.ts   # создаёт тестового Owner + тестовый инвайт-код
npm run start:dev
```

Тестовые данные после сида (только для локальной разработки):
- Owner: `test-owner@carclub.local` / `TEST-owner-password-123`
- Инвайт-код: `TEST-INVITE-0001`

### Web-admin

```bash
cd web-admin
cp .env.example .env.local   # NEXT_PUBLIC_API_URL
npm install
npm run dev
```

### Mobile (Expo)

```bash
cd mobile
cp .env.example .env
npm install
npx expo start --dev-client
```

Обычный Expo Go не подойдёт для полной сборки — защита медиа (гл. 3.3
ТЗ, `react-native-capture-protection`) требует нативных модулей и,
соответственно, кастомного Dev Client.

### Через docker-compose (Postgres + backend + web-admin + Rocket.Chat + Mongo)

```bash
cd infra
docker compose up --build
```

Поднимает всё, включая Rocket.Chat (официальный образ, без лицензии
Enterprise — см. `docs/DECISIONS.md`) и однонодовый Mongo replica set,
который он требует. **Первичная настройка Rocket.Chat — вручную,
разово:**

1. Открыть `http://localhost:3100`, пройти setup wizard, создать
   первого администратора.
2. В админке RC: `Administration → Users → <admin> → Personal Access
   Tokens` — создать токен, вписать его и `userId` администратора в
   `backend/.env` как `ROCKETCHAT_ADMIN_TOKEN`/`ROCKETCHAT_ADMIN_USER_ID`.
3. Убедиться, что `CREATE_TOKENS_FOR_USERS_SECRET` в `backend/.env`
   совпадает с одноимённой переменной у сервиса `rocketchat` в
   `infra/docker-compose.yml` (нужно для `POST /chat-bridge/session`).
4. Перезапустить `backend`.

Без этой настройки `chat-bridge` работает в режиме no-op — auth и
остальной API не блокируются, но `POST /chat-bridge/session` (и,
соответственно, чат в мобильном приложении) вернёт 503.

## Статус реализации

**Этап 1** (см. `docs/ROADMAP.md`): схема БД, backend-скелет (auth,
приглашения, заявки на вступление, роли/права, журнал аудита, реестр
модулей), веб-админка (логин, участники, приглашения, роли) — реализованы.

**Чат, этап A** (текст + группы + каналы, ТЗ гл. 3.2): реализовано —
`chat-bridge` (provisioning + выдача сессии через `users.createToken`),
`GET /users/directory`, мобильный REST/DDP-клиент Rocket.Chat
(`mobile/src/rocketchat/`, без сторонних npm-зависимостей — см.
`docs/DECISIONS.md`), экраны списка чатов/нового чата/переписки с
реалтайм-доставкой. Проверено сквозным прогоном (регистрация →
provisioning → выдача сессии → создание DM → отправка сообщения →
realtime-доставка → история) против локального мок-сервера Rocket.Chat
(протокол REST + DDP); полноценный живой Rocket.Chat не поднимался в
среде разработки этой сессии (недоступен демон Docker) — конфигурация
`infra/docker-compose.yml` не проверена вживую, только по документации
API.

**Не реализовано** (следующие итерации): фото/видео в сообщениях;
защита медиа (водяной знак, журнал доступа, детект скриншота на iOS,
`react-native-capture-protection`, кастомный защищённый плеер);
модерация чата в web-admin; push-уведомления; реакции/reply/forward/
поиск по сообщениям/статус прочтения; реальный деплой в облако; модуль
LPR (заблокирован до решения по бюджету — `docs/DECISIONS.md`); игровые
модули (Этап 2).
