'use client';

import { useEffect, useRef } from 'react';
import { useCalls } from '../lib/calls/calls-context';
import { MicIcon, PhoneIcon, VideoIcon, XIcon } from './icons';

// Глобальный оверлей звонка — смонтирован один раз в layout.tsx, поэтому
// входящий звонок виден на любой странице админки, не только на /chat.
export function CallOverlay() {
  const { status, peerName, kind, localStream, remoteStream, muted, error, acceptCall, rejectCall, endCall, toggleMute } =
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

  if (status === 'idle') {
    return error ? (
      <div className="call-toast">
        ⚠️ {error}
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
