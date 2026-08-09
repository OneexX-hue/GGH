import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChat } from '../chat-context';
import { useAuth } from '../auth-context';
import type { RCMessage } from '../rocketchat/types';
import type { RootStackParamList } from '../navigation';
import { uploadMedia, MediaApiError } from '../media/media-client';
import { decodeMediaMarker, encodeMediaMarker } from '../media/marker';
import { ProtectedMediaViewer } from '../media/ProtectedMediaViewer';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

export function ConversationScreen({ route, navigation }: Props) {
  const { roomId, roomType, title } = route.params;
  const { restClient, realtimeClient, currentRocketChatUserId } = useChat();
  const { token: authToken } = useAuth();
  const [messages, setMessages] = useState<RCMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const seenIds = useRef(new Set<string>());

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    if (!restClient) return;
    restClient
      .getHistory(roomType, roomId)
      .then((history) => {
        history.forEach((m) => seenIds.current.add(m._id));
        setMessages(history);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить историю'));
  }, [restClient, roomId, roomType]);

  useEffect(() => {
    if (!realtimeClient) return;
    return realtimeClient.onRoomMessage(roomId, (message) => {
      if (seenIds.current.has(message._id)) return;
      seenIds.current.add(message._id);
      setMessages((prev) => [message, ...prev]);
    });
  }, [realtimeClient, roomId]);

  async function onSend() {
    if (!restClient || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    try {
      const sent = await restClient.postMessage(roomId, text);
      if (!seenIds.current.has(sent._id)) {
        seenIds.current.add(sent._id);
        setMessages((prev) => [sent, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    }
  }

  async function onPickPhoto() {
    if (!restClient || !authToken) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Нет доступа к галерее');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      const upload = await uploadMedia(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? 'photo.jpg', authToken);
      const marker = encodeMediaMarker({ mediaId: upload.mediaId, kind: upload.kind });
      const sent = await restClient.postMessage(roomId, marker);
      if (!seenIds.current.has(sent._id)) {
        seenIds.current.add(sent._id);
        setMessages((prev) => [sent, ...prev]);
      }
    } catch (err) {
      setError(err instanceof MediaApiError || err instanceof Error ? err.message : 'Не удалось отправить фото');
    } finally {
      setUploading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        style={styles.list}
        data={messages}
        inverted
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const mine = item.u._id === currentRocketChatUserId;
          const mediaMarker = decodeMediaMarker(item.msg);
          return (
            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : undefined]}>
              <View
                style={[
                  mediaMarker ? styles.mediaBubble : styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                ]}
              >
                {!mine && <Text style={styles.author}>{item.u.name ?? item.u.username}</Text>}
                {mediaMarker ? (
                  <ProtectedMediaViewer mediaId={mediaMarker.mediaId} kind={mediaMarker.kind} />
                ) : (
                  <Text style={styles.text}>{item.msg}</Text>
                )}
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <Pressable style={styles.attachButton} onPress={onPickPhoto} disabled={uploading}>
          <Text style={styles.attachButtonText}>{uploading ? '…' : '📷'}</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Сообщение…"
          placeholderTextColor="#888"
          multiline
        />
        <Pressable style={styles.sendButton} onPress={onSend}>
          <Text style={styles.sendButtonText}>Отправить</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  list: { flex: 1, paddingHorizontal: 12 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10 },
  mediaBubble: { maxWidth: '80%', borderRadius: 12, padding: 6 },
  bubbleMine: { backgroundColor: '#3b82f6', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#1b1f27', alignSelf: 'flex-start' },
  author: { color: '#93c5fd', fontSize: 12, marginBottom: 2 },
  text: { color: '#fff', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1b1f27',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333842',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    backgroundColor: '#1b1f27',
    maxHeight: 100,
  },
  sendButton: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 12 },
  sendButtonText: { color: '#fff', fontWeight: '600' },
  attachButton: {
    borderWidth: 1,
    borderColor: '#333842',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#1b1f27',
  },
  attachButtonText: { fontSize: 18 },
  error: { color: '#f87171', textAlign: 'center', padding: 8 },
});
