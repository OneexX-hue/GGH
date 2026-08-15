import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Divider, Avatar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'QuestDetail'>;

interface LeaderboardEntry {
  user: { id: string; displayName: string } | undefined;
  points: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

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
      contentContainerStyle={styles.content}
      data={checkpoints}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {error && <HelperText type="error">⚠️ {error}</HelperText>}
          {message && <HelperText type="info" style={styles.success}>🎉 {message}</HelperText>}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.checkpointRow}>
          <Text style={styles.checkpointTitle}>
            📍 {item.title} <Text style={styles.points}>({item.points} баллов)</Text>
          </Text>
          {item.completed ? (
            <Text style={styles.done}>✅ Пройдено</Text>
          ) : (
            <View style={styles.redeemRow}>
              <TextInput
                mode="outlined"
                label="Код с чекпоинта"
                autoCapitalize="characters"
                value={codes[item.id] ?? ''}
                onChangeText={(text) => setCodes((prev) => ({ ...prev, [item.id]: text }))}
                style={styles.input}
                dense
              />
              <Button mode="contained" onPress={() => onRedeem(item.id)} style={styles.redeemButton}>
                Погасить
              </Button>
            </View>
          )}
        </View>
      )}
      ListFooterComponent={
        <View style={styles.footer}>
          <Divider style={styles.divider} />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            🏆 Лидерборд
          </Text>
          {leaderboard.length === 0 && <Text style={styles.dim}>Пока никто не набрал баллов</Text>}
          {leaderboard.map((entry, i) => (
            <View key={entry.user?.id ?? i} style={styles.leaderRow}>
              <Avatar.Text
                size={32}
                label={MEDALS[i] ?? String(i + 1)}
                style={styles.medalAvatar}
                labelStyle={styles.medalLabel}
              />
              <Text style={styles.leaderName}>{entry.user?.displayName ?? '—'}</Text>
              <Text style={styles.leaderPoints}>{entry.points}</Text>
            </View>
          ))}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050506' },
  content: { padding: 16 },
  checkpointRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.085)' },
  checkpointTitle: { color: '#f4f6f8', fontSize: 16, marginBottom: 8 },
  points: { color: '#8e979f', fontSize: 14 },
  done: { color: '#93bda2', fontWeight: '600' },
  redeemRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1 },
  redeemButton: { borderRadius: 10 },
  footer: { marginTop: 8 },
  divider: { marginBottom: 20 },
  sectionTitle: { marginBottom: 12, fontWeight: '700' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  medalAvatar: { backgroundColor: '#0b0d10' },
  medalLabel: { fontSize: 16 },
  leaderName: { flex: 1, color: '#f4f6f8' },
  leaderPoints: { color: '#f4f6f8', fontWeight: '700' },
  dim: { color: '#8e979f' },
  success: { color: '#93bda2' },
});
