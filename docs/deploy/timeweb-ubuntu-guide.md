# Продакшен-деплой на Ubuntu Server (Timeweb Cloud)

Пошаговый гайд для разворачивания CarClub Platform на чистом VDS/VPS с
Ubuntu Server (последняя LTS — 24.04 на момент написания) в Timeweb
Cloud — см. `docs/DECISIONS.md`, «Хостинг». Рассчитан на то, что его
выполняет либо сам владелец клуба через свой SSH-клиент, либо сессия
Claude Code, установленная прямо на этом сервере (см. обсуждение в
чате — установка Claude Code на сервер снимает сетевые ограничения,
которые есть у облачной песочницы разработки).

> ⚠️ **Этот гайд не прогонялся вживую против реального Timeweb-сервера**
> в процессе разработки — только по документации Docker/Caddy/coturn и
> логике самого `docker-compose.prod.yml` (провалидирован `docker
> compose config`, см. `docs/ROADMAP.md`). Первый реальный прогон может
> вскрыть мелкие расхождения — сверяйтесь с выводом команд по ходу.
>
> ⚠️ **Деплой на реальный сервер не равно разрешению собирать реальные
> персональные данные участников.** Юридический пункт в
> `docs/DECISIONS.md`, «Юридическая проработка ПДн» всё ещё «в
> процессе» — до его закрытия (явное одобрение владельцем клуба
> итогового текста `docs/legal/privacy-policy-draft.md`) платформа на
> этом сервере должна использоваться только с тестовыми/демо-данными
> (см. `CLAUDE.md`, правило 3).

## 0. Что нужно заранее

- Ubuntu Server 22.04/24.04 LTS, root или sudo-доступ.
- Домен (или поддомен), которым вы управляете — понадобится 3
  поддомена: `admin.<домен>`, `api.<домен>`, `chat.<домен>`.
- (Опционально, рекомендуется для прода) бакет Timeweb Cloud Object
  Storage — endpoint/регион/ключи доступа из личного кабинета.

## 1. Установка Docker Engine + Compose plugin

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# перелогиниться (или newgrp docker), чтобы применилась группа docker
docker --version
docker compose version
```

## 2. (Опционально) установка Claude Code на сервере

Если хотите, чтобы дальнейшие шаги выполняла сессия Claude Code прямо
на сервере (а не вы вручную) — снимает сетевые ограничения облачной
песочницы разработки (SSH наружу оттуда не работал, см. обсуждение в
чате), т.к. Claude Code будет работать локально на этой же машине.

```bash
# Node.js LTS — apt-репозиторий Ubuntu обычно тянет устаревшую версию,
# лучше через NodeSource:
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

node --version   # должно быть 18+
npm install -g @anthropic-ai/claude-code
claude
```

**Авторизация на headless-сервере (без графического окружения):** при
первом запуске `claude` спросит способ входа. Два рабочих варианта на
сервере без браузера:

- **Через аккаунт Claude.ai/Console** — CLI выведет ссылку и код
  подтверждения прямо в терминал; ссылку нужно открыть в браузере на
  **любом другом устройстве** (телефон, ноутбук), не обязательно на
  самом сервере — подтвердить вход, вернуться в терминал сервера,
  сессия авторизуется автоматически.
- **Через API-ключ** (если есть доступ к Anthropic Console/API отдельно
  от подписки) — без интерактивного флоу:
  ```bash
  export ANTHROPIC_API_KEY="sk-ant-..."
  claude
  ```

## 3. Клонирование репозитория

```bash
git clone https://github.com/OneexX-hue/GGH.git carclub
cd carclub
git checkout claude/project-plan-and-spec-amb6x8   # либо main, если рабочая ветка уже влита
```

## 4. DNS

В панели управления доменом создать 3 A-записи, указывающие на
публичный IP этого сервера:

```
admin.<домен>  →  <IP сервера>
api.<домен>    →  <IP сервера>
chat.<домен>   →  <IP сервера>
```

Подождать распространения DNS (обычно от пары минут до часа) — без
этого Caddy не сможет выпустить TLS-сертификаты Let's Encrypt на шаге 6.

## 5. Секреты и конфигурация

```bash
cd infra
cp .env.example .env
```

Заполнить `.env`: домены (из шага 4), и сгенерировать секреты:

```bash
openssl rand -hex 32   # выполнить несколько раз — для POSTGRES_PASSWORD,
                        # JWT_SECRET, MEDIA_ENCRYPTION_KEY,
                        # CREATE_TOKENS_FOR_USERS_SECRET,
                        # CHAT_MESSAGE_WEBHOOK_SECRET, TURN_PASSWORD
```

`ROCKETCHAT_ADMIN_TOKEN`/`ROCKETCHAT_ADMIN_USER_ID` — оставить пустыми,
заполняются на шаге 8. Если есть готовый бакет Timeweb Object Storage —
сразу заполнить блок `MEDIA_STORAGE_DRIVER=s3`/`S3_*`; иначе оставить
`MEDIA_STORAGE_DRIVER=local` (медиа хранится на диске сервера, в volume
`media-storage`).

## 6. Firewall

Открыть только то, что реально используется снаружи — Postgres/Valkey/
Mongo/сами приложения наружу не публикуются (проксируются через
Caddy), их отдельно открывать не нужно:

```bash
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (редирект на HTTPS + ACME-challenge)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw allow 3478/tcp      # TURN
sudo ufw allow 3478/udp      # TURN
sudo ufw allow 49160:49200/udp  # TURN relay-порты
sudo ufw enable
```

## 7. Запуск

```bash
cd infra
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps   # все сервисы должны быть healthy/running
```

Первый запуск может занять несколько минут (сборка backend/web-admin,
инициализация Mongo replica set, выпуск TLS-сертификатов Caddy).

## 8. Первичная настройка Rocket.Chat

Тот же процесс, что и для локальной разработки (см. `README.md`, «Через
docker-compose»), но по реальному домену:

1. Открыть `https://chat.<домен>`, пройти setup wizard, создать
   первого администратора.
2. `Administration → Users → <admin> → Personal Access Tokens` —
   создать токен.
3. Вписать токен и `userId` администратора в `infra/.env`:
   `ROCKETCHAT_ADMIN_TOKEN`/`ROCKETCHAT_ADMIN_USER_ID`.
4. Перезапустить backend, чтобы подхватить новые переменные:

```bash
docker compose -f docker-compose.prod.yml up -d backend
```

Без этого шага `chat-bridge` работает в no-op режиме — обычный API не
блокируется, но чат (`POST /chat-bridge/session`) вернёт 503.

## 9. Применить миграции и сид ролей (если ещё не применены при первом старте)

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend npm run prisma:seed
```

## 10. Проверка

- `https://admin.<домен>` — открывается страница логина.
- Создать первого владельца/пригласительный код через
  `docker compose -f docker-compose.prod.yml exec backend` (или через
  seed-скрипт из п.9, если он уже создаёт тестового владельца — сверить
  вывод) и войти.
- Отправить тестовое сообщение в чат, попробовать 1:1-звонок между
  двумя тестовыми аккаунтами — подтверждает, что и signaling (`/calls`),
  и Rocket.Chat, и coturn настроены верно.

## Обновление в будущем

```bash
cd carclub
git pull
cd infra
docker compose -f docker-compose.prod.yml up -d --build
```

## Известные ограничения этого гайда

- Резервное копирование Postgres/Mongo-томов — не описано здесь,
  отдельная задача (например, `pg_dump`/`mongodump` по расписанию —
  через cron или встроенные средства бэкапа Timeweb, если есть).
- Ротация TURN-пароля/времени жизни credential — сейчас статический
  пароль (`--lt-cred-mech`), для более строгой настройки coturn
  поддерживает `use-auth-secret` с time-limited REST-credentials — не
  входит в этот проход.
- Мониторинг/алертинг (падение сервиса, диск переполнен и т.д.) — не
  настроено, отдельная задача.
