import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import { colors } from '../theme';

interface LeaderboardEntry {
  user: { id: string; displayName: string } | undefined;
  points: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function LeaderboardScreen() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<LeaderboardEntry[]>('/modules/leaderboard/overall?limit=50', { token })
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить лидерборд'))
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
      keyExtractor={(item, i) => item.user?.id ?? String(i)}
      ListHeaderComponent={
        error ? (
          <Text style={styles.error}>⚠️ {error}</Text>
        ) : (
          <Text style={styles.subtitle}>Сумма баллов по всем игровым модулям сразу</Text>
        )
      }
      ListEmptyComponent={<Text style={styles.dim}>Пока нет начислений</Text>}
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={styles.rank}>{MEDAL[index] ?? index + 1}</Text>
          <Text style={styles.name}>{item.user?.displayName ?? '—'}</Text>
          <Text style={styles.points}>{item.points}</Text>
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
  rank: { width: 28, textAlign: 'center', fontSize: 16 },
  name: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: '600' },
  points: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  dim: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 },
});
