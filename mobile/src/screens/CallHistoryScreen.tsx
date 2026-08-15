import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import { Icon } from '../components/Icon';
import { colors } from '../theme';

type CallKind = 'AUDIO' | 'VIDEO';
type CallStatus = 'COMPLETED' | 'MISSED' | 'REJECTED' | 'FAILED';

interface CallHistoryEntry {
  id: string;
  kind: CallKind;
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
  caller: { id: string; displayName: string };
  callee: { id: string; displayName: string };
}

const STATUS_LABEL: Record<CallStatus, string> = {
  COMPLETED: 'Завершён',
  MISSED: 'Пропущен',
  REJECTED: 'Отклонён',
  FAILED: 'Не удался',
};

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '';
  const seconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CallHistoryScreen() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<CallHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<CallHistoryEntry[]>('/calls/history?take=30', { token })
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить историю звонков'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        error ? (
          <Text style={styles.error}>⚠️ {error}</Text>
        ) : (
          <Text style={styles.subtitle}>Ваши входящие и исходящие звонки</Text>
        )
      }
      ListEmptyComponent={<Text style={styles.dim}>Звонков пока не было</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Icon
            name={item.kind === 'VIDEO' ? 'video' : 'phone'}
            size={18}
            color={item.status === 'COMPLETED' ? colors.primary : colors.onSurfaceVariant}
          />
          <View style={styles.rowText}>
            <Text style={styles.name}>
              {item.caller.displayName} → {item.callee.displayName}
            </Text>
            <Text style={styles.meta}>
              {STATUS_LABEL[item.status]}
              {item.status === 'COMPLETED' ? ` · ${formatDuration(item.startedAt, item.endedAt)}` : ''} ·{' '}
              {new Date(item.startedAt).toLocaleString()}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 24 },
  subtitle: { color: colors.onSurfaceVariant, marginBottom: 12 },
  error: { color: colors.error, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  rowText: { flex: 1 },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  dim: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
});
