'use client';

import { useEffect, useRef, useState } from 'react';
import { useCalls } from '../lib/calls/calls-context';
import { MicIcon, PhoneIcon, VideoIcon, XIcon } from './icons';

function CallTile({ userId, stream, self }: { userId: string; stream: MediaStream | null; self?: boolean }) {
  const { resolvePeerName } = useCalls();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState('Участник клуба');

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (self) {
      setName('Вы');
      return;
    }
    let cancelled = false;
    resolvePeerName(userId).then((n) => {
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, self, resolvePeerName]);

  return (
    <div className={`call-grid-tile ${self ? 'call-grid-tile-self' : ''}`}>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={self} />
      ) : (
        <span className="call-grid-tile-placeholder">Подключение…</span>
      )}
      <span className="call-grid-tile-label">{name}</span>
    </div>
  );
}

// Групповой звонок (mesh, до 4 участников, см. docs/DECISIONS.md) —
// сетка плиток: своя + по одной на каждого участника комнаты. Аудио
// участников без видео (аудиозвонок) проигрывается через скрытый
// <audio>, отдельная плитка на аудио не нужна.
function GroupCallOverlay() {
  const { group, groupError, leaveCallRoom, toggleGroupMute } = useCalls();
  if (!group) return null;

  return (
    <div className="call-overlay call-overlay-connected">
      <div className="call-connected">
        <div className="call-grid" data-count={String(Math.min(group.peers.length + 1, 4))}>
          <CallTile userId="self" stream={group.kind === 'video' ? group.localStream : null} self />
          {group.peers.map((p) => (
            <CallTile key={p.userId} userId={p.userId} stream={group.kind === 'video' ? p.stream : null} />
          ))}
        </div>
        {group.peers
          .filter((p) => p.stream)
          .map((p) => (
            <audio key={p.userId} autoPlay ref={(el) => { if (el) el.srcObject = p.stream; }} />
          ))}
        <p className="call-panel-title">
          Групповой {group.kind === 'video' ? 'видео' : 'аудио'}звонок · {group.peers.length + 1}/4
        </p>
        <div className="call-panel-actions">
          <button
            className={`call-btn ${group.muted ? 'call-btn-muted' : ''}`}
            type="button"
            onClick={toggleGroupMute}
            aria-label={group.muted ? 'Включить микрофон' : 'Выключить микрофон'}
            title={group.muted ? 'Микрофон выключен' : 'Микрофон включён'}
          >
            <MicIcon size={20} />
          </button>
          <button className="call-btn call-btn-reject" type="button" onClick={leaveCallRoom} aria-label="Покинуть звонок">
            <XIcon size={20} />
          </button>
        </div>
        {groupError && <p className="call-panel-title">⚠️ {groupError}</p>}
      </div>
    </div>
  );
}

// Глобальный оверлей звонка — смонтирован один раз в layout.tsx, поэтому
// входящий звонок виден на любой странице админки, не только на /chat.
export function CallOverlay() {
  const { status, peerName, kind, localStream, remoteStream, muted, error, acceptCall, rejectCall, endCall, toggleMute, group, groupError } =
    useCalls();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (group) return <GroupCallOverlay />;

  if (status === 'idle') {
    const message = error ?? groupError;
    return message ? (
      <div className="call-toast">
        ⚠️ {message}
      </div>
    ) : null;
  }

  if (status === 'ringing') {
    return (
      <div className="call-overlay">
        <div className="call-panel">
          <p className="call-panel-title">Входящий {kind === 'video' ? 'видео' : 'аудио'}звонок</p>
          <p className="call-panel-peer">{peerName}</p>
          <div className="call-panel-actions">
            <button className="call-btn call-btn-reject" type="button" onClick={rejectCall} aria-label="Отклонить">
              <XIcon size={20} />
            </button>
            <button className="call-btn call-btn-accept" type="button" onClick={acceptCall} aria-label="Принять">
              {kind === 'video' ? <VideoIcon size={20} /> : <PhoneIcon size={20} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'calling') {
    return (
      <div className="call-overlay">
        <div className="call-panel">
          <p className="call-panel-title">Вызываем…</p>
          <p className="call-panel-peer">{peerName}</p>
          <div className="call-panel-actions">
            <button className="call-btn call-btn-reject" type="button" onClick={endCall} aria-label="Отменить">
              <XIcon size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // connected
  return (
    <div className="call-overlay call-overlay-connected">
      <div className="call-connected">
        {kind === 'video' ? (
          <div className="call-video-stage">
            <video ref={remoteVideoRef} className="call-video-remote" autoPlay playsInline />
            <video ref={localVideoRef} className="call-video-local" autoPlay playsInline muted />
          </div>
        ) : (
          <>
            <audio ref={remoteAudioRef} autoPlay />
            <p className="call-panel-title">Аудиозвонок</p>
          </>
        )}
        <p className="call-panel-peer">{peerName}</p>
        <div className="call-panel-actions">
          <button
            className={`call-btn ${muted ? 'call-btn-muted' : ''}`}
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Включить микрофон' : 'Выключить микрофон'}
            title={muted ? 'Микрофон выключен' : 'Микрофон включён'}
          >
            <MicIcon size={20} />
          </button>
          <button className="call-btn call-btn-reject" type="button" onClick={endCall} aria-label="Завершить звонок">
            <XIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
