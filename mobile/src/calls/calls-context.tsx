import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { useAuth } from '../auth-context';
import { apiFetch, API_BASE_URL } from '../api';
import { CallsSignalingClient, type CallKind } from './signaling-client';
import { getIceServers } from './ice-servers';

type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected';

interface CallState {
  status: CallStatus;
  callId: string | null;
  peerUserId: string | null;
  peerName: string | null;
  kind: CallKind | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  error: string | null;
}

const IDLE_STATE: CallState = {
  status: 'idle',
  callId: null,
  peerUserId: null,
  peerName: null,
  kind: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  error: null,
};

interface DirectoryMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  rocketChatUsername: string;
}

interface CallsContextValue extends CallState {
  ready: boolean;
  startCall: (peerUserId: string, peerName: string, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  resolvePeerName: (userId: string) => Promise<string>;
  resolvePeerUserIdByRcUsername: (rcUsername: string) => Promise<string | null>;
}

const CallsContext = createContext<CallsContextValue | undefined>(undefined);

export function CallsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CallState>(IDLE_STATE);

  const signalingRef = useRef<CallsSignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const directoryRef = useRef<DirectoryMember[] | null>(null);

  const loadDirectory = useCallback(async (): Promise<DirectoryMember[]> => {
    if (directoryRef.current) return directoryRef.current;
    if (!token) return [];
    const members = await apiFetch<DirectoryMember[]>('/users/directory', { token });
    directoryRef.current = members;
    return members;
  }, [token]);

  const resolvePeerName = useCallback(
    async (userId: string): Promise<string> => {
      const members = await loadDirectory();
      return members.find((m) => m.id === userId)?.displayName ?? 'Участник клуба';
    },
    [loadDirectory],
  );

  const resolvePeerUserIdByRcUsername = useCallback(
    async (rcUsername: string): Promise<string | null> => {
      const members = await loadDirectory();
      return members.find((m) => m.rocketChatUsername === rcUsername)?.id ?? null;
    },
    [loadDirectory],
  );

  function cleanupCall() {
    pcRef.current?.close();
    pcRef.current = null;
    stateRef.current.localStream?.getTracks().forEach((t) => t.stop());
    setState(IDLE_STATE);
  }

  function createPeerConnection(peerUserId: string, callId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        signalingRef.current?.sendIceCandidate(peerUserId, callId, event.candidate.toJSON());
      }
    };
    pc.ontrack = (event: any) => {
      setState((prev) => ({ ...prev, remoteStream: event.streams[0] ?? null, status: 'connected' }));
    };
    pcRef.current = pc;
    return pc;
  }

  const startCall = useCallback(async (peerUserId: string, peerName: string, kind: CallKind) => {
    if (!signalingRef.current) return;
    const callId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const localStream = await mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      setState({ ...IDLE_STATE, status: 'calling', callId, peerUserId, peerName, kind, localStream: localStream as unknown as MediaStream });
      signalingRef.current.callUser(peerUserId, callId, kind);
    } catch (err) {
      setState({
        ...IDLE_STATE,
        error: err instanceof Error ? err.message : 'Не удалось получить доступ к камере/микрофону',
      });
    }
  }, []);

  const acceptCall = useCallback(async () => {
    const current = stateRef.current;
    if (!current.peerUserId || !current.callId || !signalingRef.current) return;
    try {
      const localStream = await mediaDevices.getUserMedia({ audio: true, video: current.kind === 'video' });
      setState((prev) => ({ ...prev, localStream: localStream as unknown as MediaStream, status: 'connected' }));
      signalingRef.current.acceptCall(current.peerUserId, current.callId);
    } catch (err) {
      setState({ ...IDLE_STATE, error: err instanceof Error ? err.message : 'Не удалось принять звонок' });
    }
  }, []);

  const rejectCall = useCallback(() => {
    const current = stateRef.current;
    if (current.peerUserId && current.callId) {
      signalingRef.current?.rejectCall(current.peerUserId, current.callId);
    }
    cleanupCall();
  }, []);

  const endCall = useCallback(() => {
    const current = stateRef.current;
    if (current.peerUserId && current.callId) {
      signalingRef.current?.endCall(current.peerUserId, current.callId);
    }
    cleanupCall();
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => {
      const next = !prev.muted;
      prev.localStream?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return { ...prev, muted: next };
    });
  }, []);

  useEffect(() => {
    if (!token) {
      signalingRef.current?.disconnect();
      signalingRef.current = null;
      setReady(false);
      return;
    }

    const client = new CallsSignalingClient(API_BASE_URL, token, {
      onIncomingCall: ({ from, callId, kind }) => {
        resolvePeerName(from).then((peerName) => {
          setState({ ...IDLE_STATE, status: 'ringing', callId, peerUserId: from, peerName, kind });
        });
      },
      onCallAccepted: async ({ from, callId }) => {
        const current = stateRef.current;
        if (current.callId !== callId || !current.localStream) return;
        const pc = createPeerConnection(from, callId);
        current.localStream.getTracks().forEach((track) => pc.addTrack(track, current.localStream!));
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        signalingRef.current?.sendOffer(from, callId, { type: offer.type, sdp: offer.sdp! });
      },
      onOffer: async ({ from, callId, sdp }) => {
        const current = stateRef.current;
        if (current.callId !== callId || !current.localStream) return;
        const pc = createPeerConnection(from, callId);
        current.localStream.getTracks().forEach((track) => pc.addTrack(track, current.localStream!));
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalingRef.current?.sendAnswer(from, callId, { type: answer.type, sdp: answer.sdp! });
      },
      onAnswer: async ({ callId, sdp }) => {
        if (stateRef.current.callId !== callId || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      },
      onIceCandidate: async ({ callId, candidate }) => {
        if (stateRef.current.callId !== callId || !pcRef.current) return;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // ICE-кандидат мог прийти до setRemoteDescription — безопасно игнорировать одиночный сбой
        }
      },
      onCallRejected: ({ callId }) => {
        if (stateRef.current.callId === callId) cleanupCall();
      },
      onCallEnded: ({ callId }) => {
        if (stateRef.current.callId === callId) cleanupCall();
      },
      onCallFailed: ({ callId, reason }) => {
        if (stateRef.current.callId === callId) {
          setState({ ...IDLE_STATE, error: reason === 'user-offline' ? 'Участник сейчас не в сети' : reason });
        }
      },
      onClose: () => setReady(false),
    });
    client.connect();
    signalingRef.current = client;
    setReady(true);

    return () => {
      client.disconnect();
      signalingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <CallsContext.Provider
      value={{
        ...state,
        ready,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        resolvePeerName,
        resolvePeerUserIdByRcUsername,
      }}
    >
      {children}
    </CallsContext.Provider>
  );
}

export function useCalls(): CallsContextValue {
  const ctx = useContext(CallsContext);
  if (!ctx) throw new Error('useCalls должен вызываться внутри CallsProvider');
  return ctx;
}
