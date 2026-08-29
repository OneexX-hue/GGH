import { createContext, useContext, type ReactNode } from 'react';
import type { OfflineQueue, SubmitCodeRequest } from '@workspace/core';
import type { QuestClient } from './client.ts';

export interface QuestContextValue {
  client: QuestClient;
  queue: OfflineQueue<SubmitCodeRequest>;
  /**
   * Подписка на изменения на сервере. Реализация зависит от платформы:
   * в вебе это EventSource, в Expo — опрос или нативный SSE-модуль.
   * Возвращает функцию отписки. Если не передана, клиенты просто опрашивают API.
   */
  subscribe?: (onEvent: () => void) => () => void;
}

const QuestContext = createContext<QuestContextValue | null>(null);

export function QuestProvider({ value, children }: { value: QuestContextValue; children: ReactNode }) {
  return <QuestContext.Provider value={value}>{children}</QuestContext.Provider>;
}

export function useQuest(): QuestContextValue {
  const value = useContext(QuestContext);
  if (!value) throw new Error('useQuest вызван вне QuestProvider');
  return value;
}
