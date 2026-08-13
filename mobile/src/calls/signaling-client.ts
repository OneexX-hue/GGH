// Тонкий клиент сигнального WS-шлюза backend/src/calls (см.
// docs/DECISIONS.md, "WebRTC-звонки — архитектура"). React Native
// предоставляет глобальный WebSocket — как и в вебе, отдельный
// клиентский пакет для сигнализации не нужен.

export type CallKind = 'audio' | 'video';

export interface SdpPayload {
  type: string;
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface IncomingCallEvent {
  from: string;
  callId: string;
  kind: CallKind;
}
export interface CallAcceptedEvent {
  from: string;
  callId: string;
}
export interface CallRejectedEvent {
  from: string;
  callId: string;
}
export interface CallEndedEvent {
  from: string;
  callId: string;
}
export interface CallFailedEvent {
  callId: string;
  reason: string;
}
export interface OfferEvent {
  from: string;
  callId: string;
  sdp: SdpPayload;
}
export interface AnswerEvent {
  from: string;
  callId: string;
  sdp: SdpPayload;
}
export interface IceCandidateEvent {
  from: string;
  callId: string;
  candidate: IceCandidatePayload;
}

interface SignalingHandlers {
  onIncomingCall?: (e: IncomingCallEvent) => void;
  onCallAccepted?: (e: CallAcceptedEvent) => void;
  onCallRejected?: (e: CallRejectedEvent) => void;
  onCallEnded?: (e: CallEndedEvent) => void;
  onCallFailed?: (e: CallFailedEvent) => void;
  onOffer?: (e: OfferEvent) => void;
  onAnswer?: (e: AnswerEvent) => void;
  onIceCandidate?: (e: IceCandidateEvent) => void;
  onClose?: () => void;
}

function wsUrlFromApiUrl(apiUrl: string): string {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/calls';
  return url.toString();
}

export class CallsSignalingClient {
  private ws: WebSocket | null = null;

  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
    private readonly handlers: SignalingHandlers,
  ) {}

  connect() {
    const url = `${wsUrlFromApiUrl(this.apiUrl)}?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      let parsed: { event: string; data: unknown };
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        return;
      }
      this.dispatch(parsed.event, parsed.data);
    };
    this.ws.onclose = () => this.handlers.onClose?.();
  }

  private dispatch(event: string, data: unknown) {
    switch (event) {
      case 'incoming-call':
        this.handlers.onIncomingCall?.(data as IncomingCallEvent);
        break;
      case 'call-accepted':
        this.handlers.onCallAccepted?.(data as CallAcceptedEvent);
        break;
      case 'call-rejected':
        this.handlers.onCallRejected?.(data as CallRejectedEvent);
        break;
      case 'call-ended':
        this.handlers.onCallEnded?.(data as CallEndedEvent);
        break;
      case 'call-failed':
        this.handlers.onCallFailed?.(data as CallFailedEvent);
        break;
      case 'offer':
        this.handlers.onOffer?.(data as OfferEvent);
        break;
      case 'answer':
        this.handlers.onAnswer?.(data as AnswerEvent);
        break;
      case 'ice-candidate':
        this.handlers.onIceCandidate?.(data as IceCandidateEvent);
        break;
    }
  }

  private send(event: string, data: Record<string, unknown>) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ event, data }));
  }

  callUser(to: string, callId: string, kind: CallKind) {
    this.send('call-user', { to, callId, kind });
  }
  acceptCall(to: string, callId: string) {
    this.send('accept-call', { to, callId });
  }
  rejectCall(to: string, callId: string) {
    this.send('reject-call', { to, callId });
  }
  sendOffer(to: string, callId: string, sdp: SdpPayload) {
    this.send('offer', { to, callId, sdp });
  }
  sendAnswer(to: string, callId: string, sdp: SdpPayload) {
    this.send('answer', { to, callId, sdp });
  }
  sendIceCandidate(to: string, callId: string, candidate: IceCandidatePayload) {
    this.send('ice-candidate', { to, callId, candidate });
  }
  endCall(to: string, callId: string) {
    this.send('end-call', { to, callId });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
