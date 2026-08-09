import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { useChat } from '../chat-context';
import { apiFetch, ApiError } from '../api';
import type { RootStackParamList } from '../navigation';

interface DirectoryMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  rocketChatUsername: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'NewChat'>;

export function NewChatScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { restClient } = useChat();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<DirectoryMember[]>('/users/directory', { token })
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить участников'));
  }, [token]);

  function toggle(username: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }

  async function onStart() {
    if (!restClient || selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const usernames = Array.from(selected);
      if (usernames.length === 1) {
        const room = await restClient.createDirectMessage(usernames[0]);
        navigation.replace('Conversation', { roomId: room._id, roomType: 'd', title: usernames[0] });
      } else {
        if (!groupName.trim()) {
          setError('Укажите название группы/канала');
          setSubmitting(false);
          return;
        }
        const room = broadcast
          ? await restClient.createChannel(groupName.trim(), usernames, true)
          : await restClient.createGroup(groupName.trim(), usernames);
        navigation.replace('Conversation', { roomId: room._id, roomType: room.t, title: groupName.trim() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать чат');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => toggle(item.rocketChatUsername)}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.checkbox}>{selected.has(item.rocketChatUsername) ? '✓' : ''}</Text>
          </Pressable>
        )}
      />
      {selected.size > 1 && (
        <View style={styles.groupOptions}>
          <TextInput
            style={styles.input}
            placeholder="Название группы/канала"
            placeholderTextColor="#888"
            value={groupName}
            onChangeText={setGroupName}
          />
          <View style={styles.switchRow}>
            <Text style={styles.name}>Канал (писать могут только админы)</Text>
            <Switch value={broadcast} onValueChange={setBroadcast} />
          </View>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={onStart} disabled={submitting || selected.size === 0}>
        <Text style={styles.buttonText}>{submitting ? 'Создаём…' : 'Начать чат'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115', padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1f27',
  },
  name: { color: '#fff', fontSize: 16 },
  checkbox: { color: '#3b82f6', fontSize: 18, fontWeight: '700' },
  groupOptions: { marginTop: 12, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#333842',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    backgroundColor: '#1b1f27',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#f87171', marginTop: 8 },
});
