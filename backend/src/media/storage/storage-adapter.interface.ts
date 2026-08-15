// Абстракция над хранилищем зашифрованных медиа-байтов (ТЗ гл. 3.3).
// Dev-реализация — локальная ФС (см. local-filesystem-storage.adapter.ts).
// S3-совместимый адаптер для прода — отдельная задача, зависящая от
// нерешённого выбора облачного провайдера (docs/DECISIONS.md, "Хостинг") —
// не завязываться на конкретного провайдера в этом интерфейсе.
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
