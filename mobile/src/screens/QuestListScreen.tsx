import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
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
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.dim}>Сейчас нет активных квестов</Text>}
        renderItem={({ item }) => {
          const completedCount = item.checkpoints.filter((cp) => cp.completed).length;
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('QuestDetail', {
                  questId: item.id,
                  title: item.title,
                  checkpoints: item.checkpoints,
                })
              }
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.dim}>
                {completedCount}/{item.checkpoints.length} чекпоинтов пройдено
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1f27',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dim: { color: '#888', marginTop: 4 },
  error: { color: '#f87171', textAlign: 'center', marginTop: 8 },
});
