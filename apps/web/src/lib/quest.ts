import { OfflineQueue, type QueueStorage, type SubmitCodeRequest } from '@workspace/core';
import { QuestClient, type TokenStorage } from '@workspace/api-client';

const TOKEN_KEY = 'quest:token';
const DEVICE_KEY = 'quest:device-id';

/** В разработке ходим через прокси Vite, в проде — на адрес из VITE_API_URL. */
const BASE_URL = import.meta.env['VITE_API_URL'] ?? '';
const EVENT_SLUG = import.meta.env['VITE_EVENT_SLUG'] ?? 'city-quest';

const webStorage: TokenStorage = {
  get: async () => localStorage.getItem(TOKEN_KEY),
  set: async (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: async () => localStorage.removeItem(TOKEN_KEY),
};

const queueStorage: QueueStorage = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
};

export const client = new QuestClient({ baseUrl: BASE_URL, eventSlug: EVENT_SLUG, storage: webStorage });
export const queue = new OfflineQueue<SubmitCodeRequest>(queueStorage);

/**
 * Идентификатор устройства. Переживает перезагрузку вкладки и позволяет вернуться
 * в свою команду; при очистке хранилища игрок регистрируется заново.
 */
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function hasToken(): boolean {
  return localStorage.getItem(TOKEN_KEY) !== null;
}

/** Подписка на серверные события через EventSource — он сам переподключается при обрыве. */
export function subscribe(onEvent: () => void): () => void {
  const source = new EventSource(client.streamUrl());
  source.onmessage = () => onEvent();
  // Ошибку не логируем: EventSource штатно переподключается, а на игре
  // разрывы сети — норма, а не повод шуметь в консоли.
  return () => source.close();
}

export const ADMIN_TOKEN_KEY = 'quest:admin-token';
