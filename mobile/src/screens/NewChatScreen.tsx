import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, TextInput, Button, Checkbox, Switch, List, HelperText } from 'react-native-paper';
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
          <List.Item
            title={item.displayName}
            onPress={() => toggle(item.rocketChatUsername)}
            left={() => (
              <Checkbox
                status={selected.has(item.rocketChatUsername) ? 'checked' : 'unchecked'}
                onPress={() => toggle(item.rocketChatUsername)}
              />
            )}
          />
        )}
      />
      {selected.size > 1 && (
        <View style={styles.groupOptions}>
          <TextInput
            mode="outlined"
            label="Название группы/канала"
            value={groupName}
            onChangeText={setGroupName}
          />
          <View style={styles.switchRow}>
            <Text variant="bodyMedium" style={styles.switchLabel}>
              📢 Канал (писать могут только админы)
            </Text>
            <Switch value={broadcast} onValueChange={setBroadcast} />
          </View>
        </View>
      )}
      {error && <HelperText type="error">⚠️ {error}</HelperText>}
      <Button
        mode="contained"
        onPress={onStart}
        loading={submitting}
        disabled={submitting || selected.size === 0}
        style={styles.button}
      >
        {submitting ? 'Создаём…' : '💬 Начать чат'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05090d', padding: 16 },
  groupOptions: { marginTop: 12, gap: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { flex: 1, marginRight: 8 },
  button: { marginTop: 16, borderRadius: 8 },
});
