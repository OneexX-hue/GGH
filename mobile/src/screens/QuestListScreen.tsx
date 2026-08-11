import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, List, ProgressBar, HelperText } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Quests'>;

interface QuestCheckpoint {
  id: string;
  title: string;
  description: string | null;
  points: number;
  order: number;
  completed: boolean;
}

interface ActiveQuest {
  id: string;
  title: string;
  description: string | null;
  checkpoints: QuestCheckpoint[];
}

export function QuestListScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [quests, setQuests] = useState<ActiveQuest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<ActiveQuest[]>('/quests/active', { token })
      .then((result) => {
        setQuests(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить квесты'));
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
        data={quests}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={quests.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<Text style={styles.dim}>Сейчас нет активных квестов</Text>}
        renderItem={({ item }) => {
          const completedCount = item.checkpoints.filter((cp) => cp.completed).length;
          const total = item.checkpoints.length;
          const progress = total > 0 ? completedCount / total : 0;
          return (
            <List.Item
              title={`🗺️ ${item.title}`}
              description={() => (
                <View style={styles.progressBlock}>
                  <Text style={styles.dim}>
                    {completedCount}/{total} чекпоинтов пройдено
                  </Text>
                  <ProgressBar progress={progress} style={styles.progressBar} />
                </View>
              )}
              onPress={() =>
                navigation.navigate('QuestDetail', {
                  questId: item.id,
                  title: item.title,
                  checkpoints: item.checkpoints,
                })
              }
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              style={styles.row}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0b' },
  list: { paddingVertical: 8 },
  row: { paddingHorizontal: 16 },
  progressBlock: { marginTop: 4, gap: 6 },
  progressBar: { borderRadius: 4, height: 6 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  dim: { color: '#87878a' },
});
