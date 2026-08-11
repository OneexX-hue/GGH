import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Divider } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HideAndSeekDetail'>;

interface LeaderboardEntry {
  user: { id: string; displayName: string } | undefined;
  points: number;
  foundAt: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function HideAndSeekDetailScreen({ route }: Props) {
  const { roundId, points, iAmHider, found: initialFound } = route.params;
  const { token } = useAuth();
  const [found, setFound] = useState(initialFound);
  const [code, setCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadLeaderboard() {
    if (!token) return;
    apiFetch<LeaderboardEntry[]>(`/hide-and-seek/rounds/${roundId}/leaderboard`, { token })
      .then(setLeaderboard)
      .catch(() => {});
  }

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  async function onFind() {
    if (!token || !code) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ points: number }>(`/hide-and-seek/rounds/${roundId}/find`, {
        method: 'POST',
        token,
        body: { code },
      });
      setFound(true);
      setMessage(`Нашли! +${result.points} баллов`);
      loadLeaderboard();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось погасить раунд');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && <HelperText type="error">⚠️ {error}</HelperText>}
      {message && (
        <HelperText type="info" style={styles.success}>
          🎉 {message}
        </HelperText>
      )}

      {iAmHider ? (
        <Text style={styles.infoText}>🙈 Вы прячетесь в этом раунде — ждите, пока вас найдут.</Text>
      ) : found ? (
        <Text style={styles.doneText}>✅ Вы уже нашли прячущегося и получили баллы.</Text>
      ) : (
        <View>
          <Text style={styles.infoText}>🏆 {points} баллов тому, кто найдёт и назовёт код.</Text>
          <View style={styles.redeemRow}>
            <TextInput
              mode="outlined"
              label="Код от прячущегося"
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
              style={styles.input}
              dense
            />
            <Button mode="contained" onPress={onFind} loading={submitting} disabled={submitting} style={styles.findButton}>
              Нашёл!
            </Button>
          </View>
        </View>
      )}

      <Divider style={styles.divider} />
      <Text variant="titleMedium" style={styles.sectionTitle}>
        🏆 Лидерборд раунда
      </Text>
      {leaderboard.length === 0 && <Text style={styles.dim}>Пока никто не нашёл</Text>}
      {leaderboard.map((entry, i) => (
        <View key={entry.user?.id ?? i} style={styles.leaderRow}>
          <Text style={styles.medal}>{MEDALS[i] ?? `${i + 1}.`}</Text>
          <Text style={styles.leaderName}>{entry.user?.displayName ?? '—'}</Text>
          <Text style={styles.leaderPoints}>{entry.points}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121316' },
  content: { padding: 16 },
  infoText: { color: '#e8e6e1', fontSize: 15, marginBottom: 12 },
  doneText: { color: '#7fce9a', fontSize: 15, marginBottom: 12 },
  redeemRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1 },
  findButton: { borderRadius: 8 },
  divider: { marginVertical: 20 },
  sectionTitle: { marginBottom: 12, fontWeight: '700' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  medal: { width: 28, fontSize: 16 },
  leaderName: { flex: 1, color: '#e8e6e1' },
  leaderPoints: { color: '#e8a33d', fontWeight: '700' },
  dim: { color: '#9a9691' },
  success: { color: '#7fce9a' },
});
