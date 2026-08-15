import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { apiFetch, ApiError } from './api';
import { useAuth } from './auth-context';
import { RocketChatRestClient } from './rocketchat/rest-client';
import { RocketChatRealtimeClient } from './rocketchat/realtime-client';
import type { RocketChatSession } from './rocketchat/types';

interface ChatContextValue {
  ready: boolean;
  error: string | null;
  restClient: RocketChatRestClient | null;
  realtimeClient: RocketChatRealtimeClient | null;
  currentRocketChatUserId: string | null;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [session, setSession] = useState<RocketChatSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restClientRef = useRef<RocketChatRestClient | null>(null);
  const realtimeClientRef = useRef<RocketChatRealtimeClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      realtimeClientRef.current?.disconnect();
      realtimeClientRef.current = null;
      restClientRef.current = null;
      setSession(null);
      setError(null);
      return;
    }

    apiFetch<RocketChatSession>('/chat-bridge/session', { method: 'POST', token })
      .then(async (chatSession) => {
        if (cancelled) return;
        restClientRef.current = new RocketChatRestClient(chatSession);
        realtimeClientRef.current = new RocketChatRealtimeClient(chatSession);
        try {
          await realtimeClientRef.current.connect();
        } catch (err) {
          // Реалтайм — best-effort: история/отправка сообщений всё равно
          // работают через REST, даже если DDP-соединение не поднялось.
          console.warn('Rocket.Chat realtime connect failed', err);
        }
        if (!cancelled) setSession(chatSession);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Чат недоступен');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    return () => realtimeClientRef.current?.disconnect();
  }, []);

  const value: ChatContextValue = {
    ready: session !== null,
    error,
    restClient: restClientRef.current,
    realtimeClient: realtimeClientRef.current,
    currentRocketChatUserId: session?.rocketChatUserId ?? null,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat должен вызываться внутри ChatProvider');
  return ctx;
}
