import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { normalizeCode, parseQrPayload } from '@workspace/core';
import { theme } from '../src/theme.ts';

/**
 * Сканер QR-кодов заданий.
 *
 * Возвращает код на экран игры параметром маршрута, а не отправляет сам:
 * решение о сдаче остаётся за игроком, и случайно наведённая камера
 * не тратит попытку.
 */
export default function Scan() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // Камера шлёт событие на каждый кадр с кодом — без защёлки экран закроется дважды.
  const handled = useRef(false);

  if (!permission) {
    return <Centered text="Проверяю доступ к камере…" />;
  }

  if (!permission.granted) {
    return (
      <Centered text="Чтобы сканировать QR-коды заданий, нужен доступ к камере.">
        <Pressable
          onPress={() => void requestPermission()}
          style={{ backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: theme.accentText, fontWeight: '800' }}>Разрешить</Text>
        </Pressable>
      </Centered>
    );
  }

  function onScanned(raw: string) {
    if (handled.current) return;

    const parsed = parseQrPayload(raw);
    // Допускаем и «голый» код на табличке: не у всех организаторов будут ссылки.
    const code = parsed?.code ?? (raw.length <= 64 ? normalizeCode(raw) : null);
    if (code === null) {
      setError('Это не QR-код квеста.');
      return;
    }

    handled.current = true;
    router.replace({ pathname: '/game', params: { scannedCode: code, ...(taskId ? { taskId } : {}) } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScanned(data)}
      />
      <View style={{ padding: 20, gap: 10, backgroundColor: theme.bg }}>
        <Text style={{ color: theme.textDim, textAlign: 'center' }}>
          {error ?? 'Наведите камеру на QR-код задания'}
        </Text>
        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>Ввести код вручную</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Centered({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: theme.bg }}>
      <Text style={{ color: theme.textDim, textAlign: 'center' }}>{text}</Text>
      {children}
    </View>
  );
}
