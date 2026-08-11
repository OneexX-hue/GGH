import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, HelperText, ActivityIndicator, Menu } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChat } from '../chat-context';
import { useAuth } from '../auth-context';
import { apiFetch } from '../api';
import type { RCMessage } from '../rocketchat/types';
import type { RootStackParamList } from '../navigation';
import { uploadMedia, MediaApiError } from '../media/media-client';
import { decodeMediaMarker, encodeMediaMarker } from '../media/marker';
import { decodeTtlMarker, encodeTtlMarker } from '../media/ttl-marker';
import { ProtectedMediaViewer } from '../media/ProtectedMediaViewer';
import { Icon } from '../components/Icon';
import { FadeIn } from '../components/FadeIn';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

const TTL_PRESETS: { label: string; seconds: number | null }[] = [
  { label: 'Выкл.', seconds: null },
  { label: '10 секунд', seconds: 10 },
  { label: '1 минута', seconds: 60 },
  { label: '1 час', seconds: 60 * 60 },
  { label: '24 часа', seconds: 24 * 60 * 60 },
];

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}с`;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}м`;
  return `${Math.ceil(totalMinutes / 60)}ч`;
}

export function ConversationScreen({ route, navigation }: Props) {
  const { roomId, roomType, title } = route.params;
  const { restClient, realtimeClient, currentRocketChatUserId } = useChat();
  const { token: authToken } = useAuth();
  const [messages, setMessages] = useState<RCMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null);
  const [ttlMenuVisible, setTtlMenuVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function scheduleExpiry(msgId: string, expiresAt: string) {
    if (!authToken) return;
    try {
      await apiFetch(`/chat-bridge/messages/${roomId}/${msgId}/expire-at`, {
        method: 'POST',
        token: authToken,
        body: { expiresAt },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось включить самоуничтожение сообщения');
    }
  }

  async function sendBody(body: string) {
    if (!restClient) return;
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
    const wire = expiresAt ? encodeTtlMarker({ expiresAt, body }) : body;
    const sent = await restClient.postMessage(roomId, wire);
    if (!seenIds.current.has(sent._id)) {
      seenIds.current.add(sent._id);
      setMessages((prev) => [sent, ...prev]);
    }
    if (expiresAt) {
      await scheduleExpiry(sent._id, expiresAt);
    }
  }

  async function onSend() {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    try {
      await sendBody(text);
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
      await sendBody(marker);
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
          const ttl = decodeTtlMarker(item.msg);
          const remainingMs = ttl ? new Date(ttl.expiresAt).getTime() - now : null;
          const expired = ttl !== null && remainingMs !== null && remainingMs <= 0;
          const contentText = ttl ? ttl.body : item.msg;
          const mediaMarker = expired ? null : decodeMediaMarker(contentText);

          return (
            <FadeIn style={[styles.bubbleRow, mine ? styles.bubbleRowMine : undefined]}>
              <View
                style={[
                  mediaMarker ? styles.mediaBubble : styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                ]}
              >
                {!mine && <Text style={styles.author}>{item.u.name ?? item.u.username}</Text>}
                {expired ? (
                  <Text style={mine ? styles.textMine : styles.textTheirs}>🔥 Сообщение исчезло</Text>
                ) : mediaMarker ? (
                  <ProtectedMediaViewer mediaId={mediaMarker.mediaId} kind={mediaMarker.kind} />
                ) : (
                  <Text style={mine ? styles.textMine : styles.textTheirs}>{contentText}</Text>
                )}
                {ttl && !expired && remainingMs !== null && (
                  <View style={styles.timerRow}>
                    <View style={styles.timerRing}>
                      <Text style={styles.timerRingText}>{formatRemaining(remainingMs)}</Text>
                    </View>
                    <Text style={[styles.ttlBadge, mine ? styles.ttlBadgeMine : styles.ttlBadgeTheirs]}>
                      исчезнет после прочтения
                    </Text>
                  </View>
                )}
              </View>
            </FadeIn>
          );
        }}
      />
      <View style={styles.inputRow}>
        {uploading ? (
          <ActivityIndicator size={20} style={styles.attachButton} />
        ) : (
          <IconButton
            icon={(props) => <Icon name="paperclip" size={props.size * 0.75} color={props.color} />}
            mode="outlined"
            onPress={onPickPhoto}
            style={styles.attachButton}
          />
        )}
        <Menu
          visible={ttlMenuVisible}
          onDismiss={() => setTtlMenuVisible(false)}
          anchor={
            <IconButton
              icon={(props) => (
                <Icon name="timer" size={props.size * 0.75} color={ttlSeconds ? '#8ab7d8' : props.color} />
              )}
              mode="outlined"
              onPress={() => setTtlMenuVisible(true)}
              style={styles.attachButton}
            />
          }
        >
          {TTL_PRESETS.map((preset) => (
            <Menu.Item
              key={preset.label}
              title={preset.label}
              onPress={() => {
                setTtlSeconds(preset.seconds);
                setTtlMenuVisible(false);
              }}
            />
          ))}
        </Menu>
        <TextInput
          mode="outlined"
          value={draft}
          onChangeText={setDraft}
          placeholder="Сообщение…"
          multiline
          style={styles.input}
          dense
        />
        <IconButton
          icon={(props) => <Icon name="mic" size={props.size * 0.75} color={props.color} />}
          mode="contained"
          onPress={onSend}
          disabled={!draft.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05090d' },
  list: { flex: 1, paddingHorizontal: 12 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 10 },
  mediaBubble: { maxWidth: '80%', borderRadius: 14, padding: 6 },
  bubbleMine: { backgroundColor: '#0d141b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#0d141b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignSelf: 'flex-start' },
  author: { color: '#8ab7d8', fontSize: 12, marginBottom: 2 },
  textMine: { color: '#f2f5f7', fontSize: 15 },
  textTheirs: { color: '#f2f5f7', fontSize: 15 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  timerRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRingText: { fontSize: 9, color: '#f2f5f7', fontWeight: '700' },
  ttlBadge: { fontSize: 10.5, opacity: 0.75, flexShrink: 1 },
  ttlBadgeMine: { color: '#7f8993' },
  ttlBadgeTheirs: { color: '#7f8993' },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 100,
  },
  attachButton: { marginBottom: 2 },
  error: { textAlign: 'center' },
});
