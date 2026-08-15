'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from '../auth-context';
import { apiFetch } from '../api';
import { CallsSignalingClient, type CallKind } from './signaling-client';
import { getIceServers } from './ice-servers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

// Групповые звонки (mesh, до 4 участников, см. docs/DECISIONS.md) —
// отдельное состояние от 1:1-звонка (CallState выше): сервер не
// смешивает эти два режима, а один и тот же пользователь физически не
// может состоять в 1:1-звонке и в комнате одновременно (UI это не
// допускает), но в коде проще держать их раздельно, чем городить union-тип.
export interface GroupPeerState {
  userId: string;
  stream: MediaStream | null;
}

interface GroupCallState {
  callRoomId: string;
  kind: CallKind;
  localStream: MediaStream;
  muted: boolean;
  peers: GroupPeerState[];
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
  group: GroupCallState | null;
  groupError: string | null;
  joinCallRoom: (callRoomId: string, kind: CallKind) => Promise<void>;
  leaveCallRoom: () => void;
  toggleGroupMute: () => void;
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

  const [group, setGroup] = useState<GroupCallState | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const groupRef = useRef<GroupCallState | null>(null);
  groupRef.current = group;
  const groupPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

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
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingRef.current?.sendIceCandidate(peerUserId, callId, event.candidate.toJSON());
      }
    };
    pc.ontrack = (event) => {
      setState((prev) => ({ ...prev, remoteStream: event.streams[0] ?? null, status: 'connected' }));
    };
    pcRef.current = pc;
    return pc;
  }

  function cleanupGroupCall() {
    groupPcsRef.current.forEach((pc) => pc.close());
    groupPcsRef.current.clear();
    groupRef.current?.localStream.getTracks().forEach((t) => t.stop());
    setGroup(null);
  }

  function createGroupPeerConnection(peerId: string, callRoomId: string, localStream: MediaStream): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingRef.current?.sendIceCandidate(peerId, callRoomId, event.candidate.toJSON());
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? null;
      setGroup((prev) =>
        prev && prev.callRoomId === callRoomId
          ? { ...prev, peers: prev.peers.map((p) => (p.userId === peerId ? { ...p, stream } : p)) }
          : prev,
      );
    };
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    groupPcsRef.current.set(peerId, pc);
    return pc;
  }

  const joinCallRoom = useCallback(async (callRoomId: string, kind: CallKind) => {
    if (!signalingRef.current) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      setGroupError(null);
      setGroup({ callRoomId, kind, localStream, muted: false, peers: [] });
      signalingRef.current.joinCallRoom(callRoomId, kind);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Не удалось получить доступ к камере/микрофону');
    }
  }, []);

  const leaveCallRoom = useCallback(() => {
    const current = groupRef.current;
    if (current) signalingRef.current?.leaveCallRoom(current.callRoomId);
    cleanupGroupCall();
  }, []);

  const toggleGroupMute = useCallback(() => {
    setGroup((prev) => {
      if (!prev) return prev;
      const next = !prev.muted;
      prev.localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
      return { ...prev, muted: next };
    });
  }, []);

  const startCall = useCallback(
    async (peerUserId: string, peerName: string, kind: CallKind) => {
      if (!signalingRef.current) return;
      const callId = crypto.randomUUID();
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
        setState({ ...IDLE_STATE, status: 'calling', callId, peerUserId, peerName, kind, localStream });
        signalingRef.current.callUser(peerUserId, callId, kind);
      } catch (err) {
        setState({
          ...IDLE_STATE,
          error: err instanceof Error ? err.message : 'Не удалось получить доступ к камере/микрофону',
        });
      }
    },
    [],
  );

  const acceptCall = useCallback(async () => {
    const current = stateRef.current;
    if (!current.peerUserId || !current.callId || !signalingRef.current) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: current.kind === 'video',
      });
      setState((prev) => ({ ...prev, localStream, status: 'connected' }));
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
      cleanupGroupCall();
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
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingRef.current?.sendOffer(from, callId, offer);
      },
      onOffer: async ({ from, callId, sdp }) => {
        const currentGroup = groupRef.current;
        if (currentGroup && currentGroup.callRoomId === callId) {
          const pc = groupPcsRef.current.get(from) ?? createGroupPeerConnection(from, callId, currentGroup.localStream);
          await pc.setRemoteDescription(sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalingRef.current?.sendAnswer(from, callId, answer);
          setGroup((prev) =>
            prev && prev.callRoomId === callId && !prev.peers.some((p) => p.userId === from)
              ? { ...prev, peers: [...prev.peers, { userId: from, stream: null }] }
              : prev,
          );
          return;
        }
        const current = stateRef.current;
        if (current.callId !== callId || !current.localStream) return;
        const pc = createPeerConnection(from, callId);
        current.localStream.getTracks().forEach((track) => pc.addTrack(track, current.localStream!));
        await pc.setRemoteDescription(sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalingRef.current?.sendAnswer(from, callId, answer);
      },
      onAnswer: async ({ from, callId, sdp }) => {
        const currentGroup = groupRef.current;
        if (currentGroup && currentGroup.callRoomId === callId) {
          await groupPcsRef.current.get(from)?.setRemoteDescription(sdp);
          return;
        }
        if (stateRef.current.callId !== callId || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(sdp);
      },
      onIceCandidate: async ({ from, callId, candidate }) => {
        const currentGroup = groupRef.current;
        if (currentGroup && currentGroup.callRoomId === callId) {
          try {
            await groupPcsRef.current.get(from)?.addIceCandidate(candidate);
          } catch {
            // ICE-кандидат мог прийти до setRemoteDescription — безопасно игнорировать одиночный сбой
          }
          return;
        }
        if (stateRef.current.callId !== callId || !pcRef.current) return;
        try {
          await pcRef.current.addIceCandidate(candidate);
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
      onRoomPeers: async ({ callRoomId, peers }) => {
        const current = groupRef.current;
        if (!current || current.callRoomId !== callRoomId) return;
        setGroup((prev) =>
          prev && prev.callRoomId === callRoomId ? { ...prev, peers: peers.map((id) => ({ userId: id, stream: null })) } : prev,
        );
        // Мы — только что присоединившийся участник, поэтому сами
        // инициируем offer к каждому, кто уже в комнате (см. серверный
        // комментарий в calls.gateway.ts#onJoinCallRoom).
        for (const peerId of peers) {
          const pc = createGroupPeerConnection(peerId, callRoomId, current.localStream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signalingRef.current?.sendOffer(peerId, callRoomId, offer);
        }
      },
      onPeerJoined: ({ callRoomId, peerId }) => {
        const current = groupRef.current;
        if (!current || current.callRoomId !== callRoomId) return;
        setGroup((prev) => {
          if (!prev || prev.callRoomId !== callRoomId || prev.peers.some((p) => p.userId === peerId)) return prev;
          return { ...prev, peers: [...prev.peers, { userId: peerId, stream: null }] };
        });
        // Новый участник сам пришлёт offer (см. onRoomPeers выше) — здесь
        // только показываем его в сетке плиток, пока стрим не пришёл.
      },
      onPeerLeft: ({ callRoomId, peerId }) => {
        const current = groupRef.current;
        if (!current || current.callRoomId !== callRoomId) return;
        groupPcsRef.current.get(peerId)?.close();
        groupPcsRef.current.delete(peerId);
        setGroup((prev) =>
          prev && prev.callRoomId === callRoomId ? { ...prev, peers: prev.peers.filter((p) => p.userId !== peerId) } : prev,
        );
      },
      onCallRoomFull: ({ callRoomId }) => {
        const current = groupRef.current;
        if (current && current.callRoomId === callRoomId) cleanupGroupCall();
        setGroupError('Комната звонка заполнена (максимум 4 участника)');
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
        group,
        groupError,
        joinCallRoom,
        leaveCallRoom,
        toggleGroupMute,
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
