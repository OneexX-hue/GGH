import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, HelperText, ActivityIndicator } from 'react-native-paper';
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
      {error && <HelperText type="error" style={styles.error}>⚠️ {error}</HelperText>}
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
                  <Text style={mine ? styles.textMine : styles.textTheirs}>{item.msg}</Text>
                )}
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        {uploading ? (
          <ActivityIndicator size={20} style={styles.attachButton} />
        ) : (
          <IconButton icon="camera-outline" mode="outlined" onPress={onPickPhoto} style={styles.attachButton} />
        )}
        <TextInput
          mode="outlined"
          value={draft}
          onChangeText={setDraft}
          placeholder="Сообщение…"
          multiline
          style={styles.input}
          dense
        />
        <IconButton icon="send" mode="contained" onPress={onSend} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121316' },
  list: { flex: 1, paddingHorizontal: 12 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 10 },
  mediaBubble: { maxWidth: '80%', borderRadius: 14, padding: 6 },
  bubbleMine: { backgroundColor: '#e8a33d', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#1a1c20', alignSelf: 'flex-start' },
  author: { color: '#e8a33d', fontSize: 12, marginBottom: 2 },
  textMine: { color: '#1a1206', fontSize: 15 },
  textTheirs: { color: '#e8e6e1', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#2a2d33',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 100,
  },
  attachButton: { marginBottom: 2 },
  error: { textAlign: 'center' },
});
