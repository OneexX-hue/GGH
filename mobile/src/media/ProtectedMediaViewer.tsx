import { useEffect, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { CaptureProtection, CaptureEventType } from 'react-native-capture-protection';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { EmitterSubscription } from 'react-native';
import { useAuth } from '../auth-context';
import { getMediaAccessToken, mediaContentUrl, reportMediaAccessEvent } from './media-client';
import type { MediaKind } from './types';
import { colors } from '../theme';

interface Props {
  mediaId: string;
  kind: MediaKind;
}

/**
 * Защищённый просмотрщик медиа (ТЗ гл. 3.3): получает короткоживущий
 * access-токен у нашего backend, показывает контент только по нему —
 * не системной галереей/плеером. Фото стримится с водяным знаком,
 * отрендеренным сервером на лету (см. backend/src/media/media.service.ts);
 * видео сервер не перекодирует (нет ffmpeg, см. docs/DECISIONS.md),
 * водяной знак для него — клиентский UI-оверлей поверх плеера
 * (см. ProtectedVideoPlayer ниже).
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
  const [viewerDisplayName, setViewerDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<EmitterSubscription | undefined>(undefined);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    getMediaAccessToken(mediaId, authToken)
      .then(({ token, viewerDisplayName: name }) => {
        if (cancelled) return;
        setContentUrl(mediaContentUrl(mediaId, token));
        setViewerDisplayName(name);
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
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (kind === 'PHOTO') {
    return <Image source={{ uri: contentUrl }} style={styles.photo} resizeMode="cover" />;
  }

  return <ProtectedVideoPlayer contentUrl={contentUrl} viewerDisplayName={viewerDisplayName ?? ''} />;
}

interface VideoPlayerProps {
  contentUrl: string;
  viewerDisplayName: string;
}

/**
 * Встроенный проигрыватель для видео (не системный плеер — байты не
 * покидают приложение, та же защита экрана из ProtectedMediaViewer
 * действует и здесь). Водяной знак — UI-слой поверх плеера (имя
 * зрителя + текущее время), а не встроен в байты видео: сервер видео
 * не перекодирует (нет ffmpeg, см. docs/DECISIONS.md, "Водяной знак на
 * видео"). Оверлей обновляется раз в секунду, пока плеер смонтирован —
 * при паузе/перемотке остаётся видимым.
 */
function ProtectedVideoPlayer({ contentUrl, viewerDisplayName }: VideoPlayerProps) {
  const player = useVideoPlayer(contentUrl, (p) => {
    p.loop = false;
  });
  const [stampText, setStampText] = useState(() => watermarkStamp(viewerDisplayName));

  useEffect(() => {
    const interval = setInterval(() => setStampText(watermarkStamp(viewerDisplayName)), 1000);
    return () => clearInterval(interval);
  }, [viewerDisplayName]);

  return (
    <View style={styles.videoStage}>
      <VideoView player={player} style={styles.video} nativeControls allowsFullscreen={false} />
      <View style={styles.watermark} pointerEvents="none">
        <Text style={styles.watermarkText}>{stampText}</Text>
      </View>
    </View>
  );
}

// Тот же формат, что серверный водяной знак фото (см.
// backend/src/media/media.service.ts, applyWatermark): "имя · ISO-время".
function watermarkStamp(viewerDisplayName: string): string {
  return `${viewerDisplayName} · ${new Date().toISOString()}`;
}

const styles = StyleSheet.create({
  box: {
    width: 220,
    height: 160,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: 220, height: 220, borderRadius: 8, backgroundColor: colors.surfaceVariant },
  videoStage: {
    width: 220,
    height: 260,
    borderRadius: 8,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%' },
  watermark: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  watermarkText: { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  error: { color: colors.error, padding: 8, textAlign: 'center' },
});
