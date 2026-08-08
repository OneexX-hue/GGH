import type { Db } from '@workspace/db';
import { openDb } from '@workspace/db';
import { EventHub } from './event-hub.ts';

export interface AppContext {
  db: Db;
  hub: EventHub;
  adminToken: string;
}

export interface CreateContextOptions {
  dbPath?: string;
  adminToken?: string;
  seed?: boolean;
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const dbPath = options.dbPath ?? process.env['DB_PATH'] ?? 'data/quest.db';
  const adminToken = options.adminToken ?? process.env['ADMIN_TOKEN'] ?? '';

  if (adminToken === '') {
    throw new Error(
      'ADMIN_TOKEN не задан. Админка без секрета означает, что управление игрой доступно любому — сервер не стартует.',
    );
  }

  return {
    db: openDb({ path: dbPath, seed: options.seed ?? true }),
    hub: new EventHub(),
    adminToken,
  };
}
