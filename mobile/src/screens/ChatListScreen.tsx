import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChat } from '../chat-context';
import type { RCSubscription } from '../rocketchat/types';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function ChatListScreen({ navigation }: Props) {
  const { ready, error, restClient } = useChat();
  const [rooms, setRooms] = useState<RCSubscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restClient) return;
    try {
      const subs = await restClient.listSubscriptions();
      subs.sort((a, b) => (a._updatedAt < b._updatedAt ? 1 : -1));
      setRooms(subs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить чаты');
    }
  }, [restClient]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>{error ?? 'Подключаемся к чату…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Чаты</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={() => navigation.navigate('NewChat')}>
            <Text style={styles.headerAction}>Новый чат</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Quests')}>
            <Text style={styles.headerAction}>Квесты</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerAction}>Профиль</Text>
          </Pressable>
        </View>
      </View>
      {loadError && <Text style={styles.error}>{loadError}</Text>}
      <FlatList
        data={rooms}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.dim}>Пока нет ни одного чата</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('Conversation', {
                roomId: item.rid,
                roomType: item.t,
                title: item.fname ?? item.name ?? 'Чат',
              })
            }
          >
            <Text style={styles.roomName}>{item.fname ?? item.name ?? 'Чат'}</Text>
            {item.unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1115' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 56,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerButtons: { flexDirection: 'row', gap: 16 },
  headerAction: { color: '#93c5fd' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1f27',
  },
  roomName: { color: '#fff', fontSize: 16 },
  badge: { backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 20, alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dim: { color: '#888', textAlign: 'center', marginTop: 32 },
  error: { color: '#f87171', textAlign: 'center', marginBottom: 8 },
});
