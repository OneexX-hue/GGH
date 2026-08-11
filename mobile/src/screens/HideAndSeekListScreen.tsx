import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, List, Chip, HelperText } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HideAndSeek'>;

interface ActiveRound {
  id: string;
  title: string;
  description: string | null;
  points: number;
  hider: { id: string; displayName: string };
  iAmHider: boolean;
  found: boolean;
}

export function HideAndSeekListScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [rounds, setRounds] = useState<ActiveRound[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<ActiveRound[]>('/hide-and-seek/rounds/active', { token })
      .then((result) => {
        setRounds(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить раунды'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      {error && <HelperText type="error">⚠️ {error}</HelperText>}
      <FlatList
        data={rounds}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={rounds.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<Text style={styles.dim}>Сейчас нет активных раундов</Text>}
        renderItem={({ item }) => (
          <List.Item
            title={`🙈 ${item.title}`}
            description={() => (
              <View style={styles.statusRow}>
                <Text style={styles.dim}>Прячется: {item.hider.displayName}</Text>
                {item.iAmHider ? (
                  <Chip compact icon="eye-off-outline">
                    Вы прячетесь
                  </Chip>
                ) : item.found ? (
                  <Chip compact icon="check-circle-outline">
                    Найдено ✅
                  </Chip>
                ) : (
                  <Chip compact icon="star-circle-outline">
                    🏆 {item.points} баллов
                  </Chip>
                )}
              </View>
            )}
            onPress={() =>
              navigation.navigate('HideAndSeekDetail', {
                roundId: item.id,
                title: item.title,
                points: item.points,
                iAmHider: item.iAmHider,
                found: item.found,
              })
            }
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            style={styles.row}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05090d' },
  list: { paddingVertical: 8 },
  row: { paddingHorizontal: 16 },
  statusRow: { marginTop: 6, gap: 6, alignItems: 'flex-start' },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  dim: { color: '#7f8993' },
});
