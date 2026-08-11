import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestDetail'>;

interface LeaderboardEntry {
  user: { id: string; displayName: string } | undefined;
  points: number;
}

export function QuestDetailScreen({ route }: Props) {
  const { questId, checkpoints: initialCheckpoints } = route.params;
  const { token } = useAuth();
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function loadLeaderboard() {
    if (!token) return;
    apiFetch<LeaderboardEntry[]>(`/quests/${questId}/leaderboard`, { token })
      .then(setLeaderboard)
      .catch(() => {});
  }

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  async function onRedeem(checkpointId: string) {
    if (!token) return;
    const code = codes[checkpointId];
    if (!code) return;
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ points: number }>(`/quests/checkpoints/${checkpointId}/redeem`, {
        method: 'POST',
        token,
        body: { code },
      });
      setCheckpoints((prev) => prev.map((cp) => (cp.id === checkpointId ? { ...cp, completed: true } : cp)));
      setMessage(`Чекпоинт пройден! +${result.points} баллов`);
      loadLeaderboard();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось погасить чекпоинт');
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={checkpoints}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {error && <Text style={styles.error}>{error}</Text>}
          {message && <Text style={styles.success}>{message}</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.checkpointRow}>
          <Text style={styles.checkpointTitle}>
            {item.title} ({item.points} баллов)
          </Text>
          {item.completed ? (
            <Text style={styles.dim}>Пройдено ✓</Text>
          ) : (
            <View style={styles.redeemRow}>
              <TextInput
                style={styles.input}
                placeholder="Код с чекпоинта"
                placeholderTextColor="#888"
                autoCapitalize="characters"
                value={codes[item.id] ?? ''}
                onChangeText={(text) => setCodes((prev) => ({ ...prev, [item.id]: text }))}
              />
              <Pressable style={styles.button} onPress={() => onRedeem(item.id)}>
                <Text style={styles.buttonText}>Погасить</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      ListFooterComponent={
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionTitle}>Лидерборд</Text>
          {leaderboard.map((entry, i) => (
            <Text key={entry.user?.id ?? i} style={styles.dim}>
              {entry.user?.displayName ?? '—'} — {entry.points}
            </Text>
          ))}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  checkpointRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1b1f27' },
  checkpointTitle: { color: '#fff', fontSize: 16, marginBottom: 8 },
  redeemRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333842',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    backgroundColor: '#1b1f27',
  },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  dim: { color: '#888', marginTop: 2 },
  error: { color: '#f87171', marginBottom: 8 },
  success: { color: '#4ade80', marginBottom: 8 },
});
