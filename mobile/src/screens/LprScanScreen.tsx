import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Button, HelperText, Chip } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth-context';
import { submitLprPhoto, listMyLprSubmissions, LprApiError, type LprSubmissionResult } from '../lpr-client';
import { Icon } from '../components/Icon';
import { colors } from '../theme';

const STATUS_LABEL: Record<LprSubmissionResult['status'], string> = {
  PENDING: 'На модерации',
  CONFIRMED: 'Подтверждено',
  REJECTED: 'Отклонено',
};

export function LprScanScreen() {
  const { token: authToken } = useAuth();
  const [submissions, setSubmissions] = useState<LprSubmissionResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!authToken) return;
    listMyLprSubmissions(authToken).then(setSubmissions).catch(() => {});
  }, [authToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function onPickPhoto() {
    if (!authToken) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Нет доступа к камере');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      await submitLprPhoto(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? 'plate.jpg', authToken);
      load();
    } catch (err) {
      setError(err instanceof LprApiError || err instanceof Error ? err.message : 'Не удалось отправить фото');
    } finally {
      setUploading(false);
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={submissions}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Icon name="video" size={30} color={colors.primary} />
          </View>
          <Text variant="titleLarge" style={styles.title}>
            Сфотографируйте номер
          </Text>
          <Text style={styles.subtitle}>Баллы начисляются за каждый распознанный гос. номер</Text>
          {error && <HelperText type="error">⚠️ {error}</HelperText>}
          <Button
            mode="contained"
            onPress={onPickPhoto}
            loading={uploading}
            disabled={uploading}
            style={styles.button}
            icon={({ size, color }) => <Icon name="video" size={size * 0.75} color={color} />}
          >
            Сделать фото
          </Button>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.plate}>{item.detectedPlate ?? '— номер не распознан —'}</Text>
          <View style={styles.rowMeta}>
            <Chip compact>{STATUS_LABEL[item.status]}</Chip>
            {item.points !== null && <Text style={styles.points}>+{item.points}</Text>}
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.dim}>Пока нет отправленных фото</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24 },
  header: { alignItems: 'center', marginBottom: 20 },
  brandMark: { marginBottom: 6 },
  title: { textAlign: 'center', fontWeight: '700' },
  subtitle: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  button: { borderRadius: 10, alignSelf: 'stretch' },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plate: { color: colors.onSurface, fontWeight: '600', fontSize: 15 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  points: { color: colors.success, fontWeight: '700' },
  dim: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
});
