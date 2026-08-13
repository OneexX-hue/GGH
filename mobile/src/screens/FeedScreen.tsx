import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import { colors } from '../theme';

interface FeedEntry {
  id: string;
  moduleKey: string;
  points: number;
  reason: string;
  occurredAt: string;
  user: { id: string; displayName: string };
}

export function FeedScreen() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<FeedEntry[]>('/modules/feed/recent?take=30', { token })
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить ленту'))
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
          <Text style={styles.subtitle}>Последние начисления баллов по всем модулям сразу</Text>
        )
      }
      ListEmptyComponent={<Text style={styles.dim}>Событий пока нет</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.name}>{item.user.displayName}</Text>
            <Text style={styles.reason}>{item.reason}</Text>
            <Text style={styles.time}>{new Date(item.occurredAt).toLocaleString()}</Text>
          </View>
          <Text style={styles.points}>+{item.points}</Text>
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
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  rowText: { flex: 1 },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: '600' },
  reason: { color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 },
  time: { color: colors.onSurfaceVariant, fontSize: 11, marginTop: 2 },
  points: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  dim: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
});
