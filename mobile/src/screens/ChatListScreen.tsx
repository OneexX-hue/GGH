import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, TextInput as RNTextInput } from 'react-native';
import { Appbar, Text, ActivityIndicator } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChat } from '../chat-context';
import type { RCSubscription } from '../rocketchat/types';
import type { RootStackParamList } from '../navigation';
import { Icon } from '../components/Icon';
import { AvatarSilhouette } from '../components/AvatarSilhouette';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;
type Filter = 'all' | 'unread' | 'fav';

export function ChatListScreen({ navigation }: Props) {
  const { ready, error, restClient } = useChat();
  const [rooms, setRooms] = useState<RCSubscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

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

  async function onToggleFavorite(room: RCSubscription) {
    if (!restClient) return;
    const next = !room.f;
    setRooms((prev) => prev.map((r) => (r._id === room._id ? { ...r, f: next } : r)));
    try {
      await restClient.toggleFavorite(room.rid, next);
    } catch {
      setRooms((prev) => prev.map((r) => (r._id === room._id ? { ...r, f: !next } : r)));
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((item) => {
      const name = (item.fname ?? item.name ?? '').toLowerCase();
      if (q && !name.includes(q)) return false;
      if (filter === 'unread') return item.unread > 0;
      if (filter === 'fav') return !!item.f;
      return true;
    });
  }, [rooms, query, filter]);

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
        <Appbar.Content title="Чаты" />
        <Appbar.Action
          icon={(props) => <Icon name="plus" size={props.size * 0.75} color={props.color} />}
          onPress={() => navigation.navigate('NewChat')}
        />
        <Appbar.Action icon="map-marker-path" onPress={() => navigation.navigate('Quests')} />
        <Appbar.Action
          icon={(props) => <Icon name="mask" size={props.size * 0.75} color={props.color} />}
          onPress={() => navigation.navigate('HideAndSeek')}
        />
        <Appbar.Action icon="account-circle-outline" onPress={() => navigation.navigate('Profile')} />
      </Appbar.Header>

      <View style={styles.searchField}>
        <Icon name="search" size={18} color={colors.onSurfaceVariant} />
        <RNTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск"
          placeholderTextColor={colors.onSurfaceVariant}
          style={styles.searchInput}
        />
        <Icon name="sliders" size={18} color={colors.onSurfaceVariant} />
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['all', 'Все'],
            ['unread', 'Непрочитанные'],
            ['fav', 'Избранные'],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.tab, filter === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, filter === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loadError && <Text style={styles.error}>⚠️ {loadError}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={filtered.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <Text style={styles.dim}>{rooms.length === 0 ? 'Пока нет ни одного чата' : 'Ничего не найдено'}</Text>
        }
        renderItem={({ item }) => {
          const name = item.fname ?? item.name ?? 'Чат';
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('Conversation', {
                  roomId: item.rid,
                  roomType: item.t,
                  title: name,
                })
              }
            >
              <AvatarSilhouette id={item.rid} isGroup={item.t !== 'd'} size={44} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={styles.rowNameWrap}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Icon name="lock-solid" size={12} color={colors.onSurfaceVariant} />
                  </View>
                  <Text style={styles.rowTime}>{formatTime(item._updatedAt)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {item.lastMessage?.msg ?? ''}
                  </Text>
                  {item.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                  ) : (
                    <Pressable hitSlop={8} onPress={() => onToggleFavorite(item)}>
                      <Icon name="star" size={16} color={item.f ? colors.primary : colors.onSurfaceVariant} />
                    </Pressable>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, padding: 0 },
  tabs: { flexDirection: 'row', gap: 2, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  tab: { height: 32, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  tabActive: { backgroundColor: colors.surfaceElevated },
  tabText: { fontSize: 12.5, color: colors.onSurfaceVariant },
  tabTextActive: { color: colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  rowBody: { flex: 1, gap: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.onSurface, flexShrink: 1 },
  rowTime: { fontSize: 12, color: colors.onSurfaceVariant },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowPreview: { flex: 1, fontSize: 11.5, color: colors.onSurfaceVariant },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, color: colors.onSurface, fontVariant: ['tabular-nums'] },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  dim: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
  error: { color: colors.error, textAlign: 'center', marginVertical: 8 },
});
