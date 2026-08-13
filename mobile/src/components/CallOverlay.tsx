import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useCalls } from '../calls/calls-context';
import { Icon } from './Icon';
import { colors } from '../theme';

// Глобальный оверлей звонка — смонтирован один раз в App.tsx рядом с
// RootNavigator, поэтому входящий звонок виден на любом экране, не
// только в диалоге. См. web-admin/components/CallOverlay.tsx — тот же
// принцип и протокол на другой платформе.
export function CallOverlay() {
  const { status, peerName, kind, localStream, remoteStream, muted, error, acceptCall, rejectCall, endCall, toggleMute } =
    useCalls();

  if (status === 'idle') {
    if (!error) return null;
    return (
      <View style={styles.toast} pointerEvents="none">
        <Text style={styles.toastText}>⚠️ {error}</Text>
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {status === 'ringing' && (
          <View style={styles.panel}>
            <Text style={styles.title}>Входящий {kind === 'video' ? 'видео' : 'аудио'}звонок</Text>
            <Text style={styles.peer}>{peerName}</Text>
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnReject]} onPress={rejectCall}>
                <Icon name="x" size={22} color="#fff" />
              </Pressable>
              <Pressable style={[styles.btn, styles.btnAccept]} onPress={acceptCall}>
                <Icon name={kind === 'video' ? 'video' : 'phone'} size={22} color="#06170d" />
              </Pressable>
            </View>
          </View>
        )}

        {status === 'calling' && (
          <View style={styles.panel}>
            <Text style={styles.title}>Вызываем…</Text>
            <Text style={styles.peer}>{peerName}</Text>
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnReject]} onPress={endCall}>
                <Icon name="x" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {status === 'connected' && (
          <View style={styles.connected}>
            {kind === 'video' ? (
              <View style={styles.videoStage}>
                {remoteStream && (
                  <RTCView streamURL={remoteStream.toURL()} style={styles.videoRemote} objectFit="cover" />
                )}
                {localStream && (
                  <RTCView streamURL={localStream.toURL()} style={styles.videoLocal} objectFit="cover" zOrder={1} mirror />
                )}
              </View>
            ) : (
              <Text style={styles.title}>Аудиозвонок</Text>
            )}
            <Text style={styles.peer}>{peerName}</Text>
            <View style={styles.actions}>
              <Pressable style={[styles.btn, muted && styles.btnMuted]} onPress={toggleMute}>
                <Icon name="mic" size={22} color={colors.onSurface} />
              </Pressable>
              <Pressable style={[styles.btn, styles.btnReject]} onPress={endCall}>
                <Icon name="x" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3,4,5,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { alignItems: 'center', gap: 6, padding: 28 },
  title: { color: colors.onSurfaceVariant, fontSize: 13 },
  peer: { color: colors.onSurface, fontSize: 22, fontWeight: '600', marginTop: 4, marginBottom: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  btnAccept: { backgroundColor: '#93bda2' },
  btnReject: { backgroundColor: '#e5483c' },
  btnMuted: { backgroundColor: '#e5483c' },
  connected: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  videoStage: {
    width: '90%',
    height: '65%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 20,
  },
  videoRemote: { width: '100%', height: '100%' },
  videoLocal: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 110,
    height: 150,
    borderRadius: 10,
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
  },
  toastText: { color: '#e5483c', fontSize: 13, textAlign: 'center' },
});
