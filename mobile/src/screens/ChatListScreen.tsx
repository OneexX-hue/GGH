import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Appbar, Avatar, Badge, List, Text, ActivityIndicator } from 'react-native-paper';
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
        <ActivityIndicator animating size="large" />
        <Text style={styles.dim}>{error ?? 'Подключаемся к чату…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.Content title="💬 Чаты" />
        <Appbar.Action icon="plus-circle-outline" onPress={() => navigation.navigate('NewChat')} />
        <Appbar.Action icon="map-marker-path" onPress={() => navigation.navigate('Quests')} />
        <Appbar.Action icon="incognito" onPress={() => navigation.navigate('HideAndSeek')} />
        <Appbar.Action icon="account-circle-outline" onPress={() => navigation.navigate('Profile')} />
      </Appbar.Header>
      {loadError && <Text style={styles.error}>⚠️ {loadError}</Text>}
      <FlatList
        data={rooms}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={rooms.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={<Text style={styles.dim}>Пока нет ни одного чата</Text>}
        renderItem={({ item }) => {
          const name = item.fname ?? item.name ?? 'Чат';
          return (
            <List.Item
              title={name}
              onPress={() =>
                navigation.navigate('Conversation', {
                  roomId: item.rid,
                  roomType: item.t,
                  title: name,
                })
              }
              left={(props) => <Avatar.Text {...props} size={44} label={initials(name)} />}
              right={() =>
                item.unread > 0 ? (
                  <Badge size={22} style={styles.badge}>
                    {item.unread}
                  </Badge>
                ) : null
              }
              style={styles.row}
            />
          );
        }}
      />
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0b', gap: 12 },
  row: { paddingHorizontal: 16, alignItems: 'center' },
  badge: { alignSelf: 'center' },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  dim: { color: '#87878a', textAlign: 'center', marginTop: 8 },
  error: { color: '#d97a72', textAlign: 'center', marginVertical: 8 },
});
