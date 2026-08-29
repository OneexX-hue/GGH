import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { OfflineQueue, type QueueStorage, type SubmitCodeRequest } from '@workspace/core';
import { QuestClient, type TokenStorage } from '@workspace/api-client';

const TOKEN_KEY = 'quest_token';
const DEVICE_KEY = 'quest_device_id';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; eventSlug?: string };

/**
 * EXPO_PUBLIC_API_URL (заданный в eas.json на этапе сборки) имеет приоритет
 * над app.json — иначе собранный APK ходил бы на localhost телефона, а не
 * на настоящий сервер. app.json остаётся фолбэком для запуска через Expo Go,
 * где Metro подставляет адрес разработки сам.
 */
const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? extra.apiUrl ?? 'http://localhost:8080';
const EVENT_SLUG = process.env['EXPO_PUBLIC_EVENT_SLUG'] ?? extra.eventSlug ?? 'city-quest';

/**
 * Токен лежит в SecureStore (Keychain на iOS, EncryptedSharedPreferences на Android):
 * это ключ к результатам команды, и в обычном AsyncStorage ему не место.
 */
const tokenStorage: TokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

/** Очередь отправок — обычное хранилище: секретов в ней нет, а объём больше. */
const queueStorage: QueueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export const client = new QuestClient({ baseUrl: BASE_URL, eventSlug: EVENT_SLUG, storage: tokenStorage });
export const queue = new OfflineQueue<SubmitCodeRequest>(queueStorage);

export async function deviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const id = globalThis.crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY, id);
  return id;
}

export async function hasToken(): Promise<boolean> {
  return (await SecureStore.getItemAsync(TOKEN_KEY)) !== null;
}

/**
 * Подписка на обновления.
 *
 * EventSource в React Native нет, а тянуть polyfill ради одного потока не стоит:
 * опрос раз в 15 секунд даёт достаточную свежесть таймера и табло, при этом
 * переживает засыпание приложения без переподключений.
 */
export function subscribe(onEvent: () => void): () => void {
  const id = setInterval(onEvent, 15_000);
  return () => clearInterval(id);
}
