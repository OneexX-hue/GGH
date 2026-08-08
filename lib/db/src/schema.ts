/**
 * Схема БД. Миграции применяются по порядку и записываются в `schema_migrations`,
 * поэтому повторный запуск сервера безопасен.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_initial',
    sql: `
      CREATE TABLE events (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        slug           TEXT NOT NULL UNIQUE,
        status         TEXT NOT NULL DEFAULT 'draft',
        duration_ms    INTEGER NOT NULL,
        started_at     INTEGER,
        paused_at      INTEGER,
        total_paused_ms INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL
      );

      CREATE TABLE teams (
        id         TEXT PRIMARY KEY,
        event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (event_id, name)
      );

      CREATE TABLE players (
        id           TEXT PRIMARY KEY,
        event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        role         TEXT NOT NULL DEFAULT 'player',
        token_hash   TEXT NOT NULL UNIQUE,
        device_id    TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        last_seen_at INTEGER,
        UNIQUE (event_id, device_id)
      );
      CREATE INDEX idx_players_team ON players(team_id);

      CREATE TABLE tasks (
        id              TEXT PRIMARY KEY,
        event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        order_index     INTEGER NOT NULL,
        title           TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        code            TEXT,
        points          INTEGER NOT NULL DEFAULT 10,
        verification    TEXT NOT NULL DEFAULT 'code',
        lat             REAL,
        lng             REAL,
        radius_m        INTEGER,
        quality_enabled INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL
      );
      CREATE INDEX idx_tasks_event ON tasks(event_id, order_index);

      CREATE TABLE submissions (
        id              TEXT PRIMARY KEY,
        event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        player_id       TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL,
        status          TEXT NOT NULL,
        points_awarded  INTEGER NOT NULL DEFAULT 0,
        lat             REAL,
        lng             REAL,
        created_at      INTEGER NOT NULL,
        UNIQUE (team_id, idempotency_key)
      );
      -- Задание засчитывается команде ровно один раз. Ограничение на уровне БД,
      -- а не на уровне кода: две параллельные отправки не пролезут обе.
      CREATE UNIQUE INDEX idx_submission_solved
        ON submissions(team_id, task_id) WHERE status = 'accepted';

      CREATE TABLE quality_codes (
        id       TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        code     TEXT NOT NULL,
        points   INTEGER NOT NULL,
        label    TEXT NOT NULL,
        UNIQUE (event_id, code)
      );

      CREATE TABLE quality_claims (
        id              TEXT PRIMARY KEY,
        event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        quality_code_id TEXT NOT NULL REFERENCES quality_codes(id) ON DELETE CASCADE,
        player_id       TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL,
        created_at      INTEGER NOT NULL,
        UNIQUE (team_id, idempotency_key)
      );
      -- Оценка качества выставляется один раз на связку команда+задание.
      CREATE UNIQUE INDEX idx_quality_once ON quality_claims(team_id, task_id);

      -- Журнал всех попыток, включая неудачные. Нужен админу, чтобы увидеть
      -- команду, которая перебирает коды или получает их из чужого чата.
      CREATE TABLE attempt_log (
        id         TEXT PRIMARY KEY,
        event_id   TEXT NOT NULL,
        team_id    TEXT NOT NULL,
        player_id  TEXT NOT NULL,
        task_id    TEXT,
        value      TEXT NOT NULL,
        ok         INTEGER NOT NULL,
        reason     TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_attempt_team_time ON attempt_log(team_id, created_at);
    `,
  },
];
