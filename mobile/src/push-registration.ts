import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

// Регистрирует Expo push-токен устройства на backend (POST /users/me/push-token),
// откуда его использует PushNotificationService при начислении баллов
// (квесты/прятки/LPR) — см. backend/src/push/. Best-effort: отсутствие
// разрешения на уведомления не должно ломать вход в приложение.
export async function registerForPushNotifications(authToken: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await apiFetch('/users/me/push-token', { method: 'POST', token: authToken, body: { token: expoPushToken } });
  } catch {
    // Best-effort — работа приложения не зависит от push-уведомлений.
  }
}
