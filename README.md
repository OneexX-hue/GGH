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

### Через docker-compose

```bash
cd infra
docker compose up --build
```

Поднимает Postgres + backend + web-admin. Rocket.Chat — отдельный
профиль, закомментирован до готовности `backend/src/chat-bridge`
(см. `infra/docker-compose.yml`).

## Статус реализации

Этап 1 (см. `docs/ROADMAP.md`): схема БД, backend-скелет (auth,
приглашения, заявки на вступление, роли/права, журнал аудита, реестр
модулей, каркас интеграции с Rocket.Chat), веб-админка (логин,
участники, приглашения, роли), каркас мобильного клиента — реализованы.

Не входит в Этап 1 (следующие шаги): полноценный чат в мобильном
клиенте, реальный деплой Rocket.Chat, деплой в облако, модуль LPR
(заблокирован до решения по бюджету — `docs/DECISIONS.md`), игровые
модули (Этап 2).
