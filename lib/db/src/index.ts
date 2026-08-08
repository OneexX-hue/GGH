import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AdminTask, EventStatus, Player, QualityCode, QuestEvent, Task, TaskVerification, Team } from '@workspace/core';
import { MIGRATIONS } from './schema.ts';
import { DEFAULT_TASKS, DEFAULT_QUALITY_CODES } from './seed.ts';

export { DEFAULT_TASKS, DEFAULT_QUALITY_CODES } from './seed.ts';

export type Db = DatabaseSync;

/** Строки, как их отдаёт node:sqlite — все значения примитивны. */
type Row = Record<string, unknown>;

export interface OpenOptions {
  /** Путь к файлу БД. ':memory:' — база в памяти, для тестов. */
  path: string;
  /** Создать демонстрационное событие с 10 заданиями, если база пуста. */
  seed?: boolean;
}

export function openDb({ path, seed = true }: OpenOptions): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);

  // WAL позволяет читать во время записи — иначе табло админа блокирует приём кодов.
  // busy_timeout: при одновременной записи ждать, а не падать с SQLITE_BUSY.
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');

  migrate(db);
  if (seed) seedIfEmpty(db);
  return db;
}

function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);');
  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as Row[]).map((r) => String(r['id'])),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(migration.id, Date.now());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Миграция ${migration.id} не применилась: ${String(error)}`);
    }
  }
}

/** Демо-событие создаётся только в пустой базе, чтобы не мешать реальным данным. */
function seedIfEmpty(db: Db): void {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM events').get() as Row | undefined)?.['n'];
  if (Number(count ?? 0) > 0) return;

  const now = Date.now();
  const eventId = randomUUID();
  db.prepare(
    `INSERT INTO events (id, name, slug, status, duration_ms, started_at, paused_at, total_paused_ms, created_at)
     VALUES (?, ?, ?, 'draft', ?, NULL, NULL, 0, ?)`,
  ).run(eventId, 'Городской квест', 'city-quest', 2 * 60 * 60 * 1000, now);

  const insertTask = db.prepare(
    `INSERT INTO tasks (id, event_id, order_index, title, description, code, points, verification, lat, lng, radius_m, quality_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  );
  DEFAULT_TASKS.forEach((task, index) => {
    insertTask.run(
      randomUUID(),
      eventId,
      index,
      task.title,
      task.description,
      task.code,
      task.points,
      'code',
      task.qualityEnabled ? 1 : 0,
      now,
    );
  });

  const insertQuality = db.prepare(
    'INSERT INTO quality_codes (id, event_id, code, points, label) VALUES (?, ?, ?, ?, ?)',
  );
  for (const qc of DEFAULT_QUALITY_CODES) {
    insertQuality.run(randomUUID(), eventId, qc.code, qc.points, qc.label);
  }
}

/* -------------------------------------------------------------- мапперы */

export function rowToEvent(row: Row): QuestEvent {
  return {
    id: String(row['id']),
    name: String(row['name']),
    slug: String(row['slug']),
    status: String(row['status']) as EventStatus,
    durationMs: Number(row['duration_ms']),
    startedAt: nullableInt(row['started_at']),
    pausedAt: nullableInt(row['paused_at']),
    totalPausedMs: Number(row['total_paused_ms']),
    createdAt: Number(row['created_at']),
  };
}

export function rowToTeam(row: Row): Team {
  return {
    id: String(row['id']),
    eventId: String(row['event_id']),
    name: String(row['name']),
    createdAt: Number(row['created_at']),
  };
}

export function rowToPlayer(row: Row): Player {
  return {
    id: String(row['id']),
    eventId: String(row['event_id']),
    teamId: String(row['team_id']),
    name: String(row['name']),
    role: String(row['role']) as Player['role'],
    createdAt: Number(row['created_at']),
    lastSeenAt: nullableInt(row['last_seen_at']),
  };
}

/** Публичное представление задания — без `code`, иначе ответ виден в сетевой панели. */
export function rowToTask(row: Row): Task {
  return {
    id: String(row['id']),
    eventId: String(row['event_id']),
    orderIndex: Number(row['order_index']),
    title: String(row['title']),
    description: String(row['description'] ?? ''),
    points: Number(row['points']),
    verification: String(row['verification']) as TaskVerification,
    lat: nullableFloat(row['lat']),
    lng: nullableFloat(row['lng']),
    radiusM: nullableInt(row['radius_m']),
    qualityEnabled: Number(row['quality_enabled']) === 1,
  };
}

export function rowToAdminTask(row: Row): AdminTask {
  return { ...rowToTask(row), code: row['code'] === null || row['code'] === undefined ? null : String(row['code']) };
}

export function rowToQualityCode(row: Row): QualityCode {
  return {
    id: String(row['id']),
    eventId: String(row['event_id']),
    code: String(row['code']),
    points: Number(row['points']),
    label: String(row['label']),
  };
}

function nullableInt(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function nullableFloat(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}
