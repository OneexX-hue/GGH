// Абстракция над сторонним API распознавания номеров (ТЗ гл. 3.4, см.
// docs/DECISIONS.md — "LPR — бюджетный путь": стороннее платное API, не
// собственная модель). Тот же паттерн, что StorageAdapter
// (backend/src/media/storage/storage-adapter.interface.ts) — позволяет
// сменить вендора без переписывания модуля.
export interface LprResult {
  plate: string | null;
  confidence: number | null; // 0..1, null если вендор не вернул уверенность
}

export interface LprAdapter {
  recognize(imageBuffer: Buffer): Promise<LprResult>;
}

export const LPR_ADAPTER = Symbol('LPR_ADAPTER');

export class LprNotConfiguredError extends Error {
  constructor() {
    super('LPR_API_KEY не задан — модуль распознавания номеров не настроен');
    this.name = 'LprNotConfiguredError';
  }
}
