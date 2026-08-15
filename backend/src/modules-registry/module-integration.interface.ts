// Контракт интеграции игрового модуля с ядром (ТЗ гл. 3.5).
// Реальные модули (авто-квест, прятки — Этап 2 по ROADMAP.md) реализуют
// этот интерфейс в собственном пакете под modules/*, регистрируясь здесь
// только записью в ModuleDefinition. Ядро не импортирует код модулей напрямую.

export interface ModuleStatEvent {
  moduleKey: string;
  userId: string;
  points: number;
  reason: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface GameModuleIntegration {
  readonly key: string;

  /** Публикация события в общую шину статистики (обновляет User.pointsTotal). */
  publishStatEvent(event: ModuleStatEvent): Promise<void>;

  /** Опциональная публикация результата в общий чат/канал клуба (через chat-bridge). */
  publishToChat?(channelKey: string, message: string): Promise<void>;
}
