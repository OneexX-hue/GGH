import { useEffect, useRef, useState } from 'react';
import { View, Image, Text, Pressable, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import { CaptureProtection, CaptureEventType } from 'react-native-capture-protection';
import type { EmitterSubscription } from 'react-native';
import { useAuth } from '../auth-context';
import { getMediaAccessToken, mediaContentUrl, reportMediaAccessEvent } from './media-client';
import type { MediaKind } from './types';

interface Props {
  mediaId: string;
  kind: MediaKind;
}

/**
 * Защищённый просмотрщик медиа (ТЗ гл. 3.3): получает короткоживущий
 * access-токен у нашего backend, показывает контент только по нему
 * (не системной галереей — картинка/видео стримится напрямую с водяным
 * знаком, отрендеренным сервером на лету, см. backend/src/media/media.service.ts).
 *
 * Защита экрана на время показа:
 * - Android: `CaptureProtection.prevent({screenshot:true, record:true})`
 *   реально блокирует скриншот/запись экрана (`FLAG_SECURE`) — событие
 *   CAPTURED в этом случае обычно не наступает, т.к. ОС не даёт снять кадр.
 * - iOS: системного API полной блокировки не существует — библиотека
 *   только детектирует факт скриншота постфактум, событие обрабатывается
 *   ниже и репортится в журнал доступа (`SCREENSHOT_DETECTED`).
 * ⚠️ Не проверено на реальном устройстве в этой сессии — нет
 * устройства/эмулятора/нативной сборки Expo Dev Client, см. README.
 */
export function ProtectedMediaViewer({ mediaId, kind }: Props) {
  const { token: authToken } = useAuth();
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<EmitterSubscription | undefined>(undefined);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    getMediaAccessToken(mediaId, authToken)
      .then(({ token }) => {
        if (!cancelled) setContentUrl(mediaContentUrl(mediaId, token));
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить медиа');
      });

    CaptureProtection.prevent({ screenshot: true, record: true }).catch(() => {
      // На некоторых платформах/версиях ОС требуется разрешение или
      // недоступно — не блокируем просмотр из-за этого, только логируем.
      console.warn('CaptureProtection.prevent недоступен на этом устройстве');
    });

    listenerRef.current = CaptureProtection.addListener((eventType) => {
      if (eventType === CaptureEventType.CAPTURED) {
        reportMediaAccessEvent(mediaId, 'SCREENSHOT_DETECTED', authToken, { platform: Platform.OS }).catch(() => {
          // best-effort — не показываем ошибку пользователю за факт скриншота
        });
      }
    });

    return () => {
      cancelled = true;
      CaptureProtection.allow({ screenshot: true, record: true }).catch(() => {});
      if (listenerRef.current) CaptureProtection.removeListener(listenerRef.current);
    };
  }, [mediaId, authToken]);

  if (error) {
    return (
      <View style={styles.box}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!contentUrl) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (kind === 'PHOTO') {
    return <Image source={{ uri: contentUrl }} style={styles.photo} resizeMode="cover" />;
  }

  // Видео: полноценный встроенный плеер — отдельная итерация (нужен
  // expo-video/react-native-video с собственным due diligence, см.
  // docs/DECISIONS.md). Пока открываем в системном плеере по токенизированной
  // ссылке — тоже кастомный путь (не сохраняется в галерею приложением),
  // но не такой же защищённый просмотр, как для фото.
  return (
    <Pressable style={styles.videoBox} onPress={() => Linking.openURL(contentUrl)}>
      <Text style={styles.videoLabel}>▶ Видео — открыть</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 220,
    height: 160,
    borderRadius: 8,
    backgroundColor: '#1b1f27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: 220, height: 220, borderRadius: 8, backgroundColor: '#1b1f27' },
  videoBox: {
    width: 220,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#1b1f27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: { color: '#93c5fd', fontWeight: '600' },
  error: { color: '#f87171', padding: 8, textAlign: 'center' },
});
