'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { apiFetch } from './api';
import { RocketChatRestClient } from './rocketchat/rest-client';
import { RocketChatRealtimeClient } from './rocketchat/realtime-client';
import type { RocketChatSession } from './rocketchat/types';

interface ChatContextValue {
  ready: boolean;
  error: string | null;
  restClient: RocketChatRestClient | null;
  realtimeClient: RocketChatRealtimeClient | null;
  session: RocketChatSession | null;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [restClient, setRestClient] = useState<RocketChatRestClient | null>(null);
  const [realtimeClient, setRealtimeClient] = useState<RocketChatRealtimeClient | null>(null);
  const [session, setSession] = useState<RocketChatSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const realtimeRef = useRef<RocketChatRealtimeClient | null>(null);

  useEffect(() => {
    if (!token) {
      setRestClient(null);
      setSession(null);
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
      setRealtimeClient(null);
      return;
    }
    let cancelled = false;
    apiFetch<RocketChatSession>('/chat-bridge/session', { method: 'POST', token })
      .then((s) => {
        if (cancelled) return;
        setRestClient(new RocketChatRestClient(s));
        setSession(s);

        const client = new RocketChatRealtimeClient(s);
        realtimeRef.current = client;
        client
          .connect()
          .then(() => {
            if (!cancelled) setRealtimeClient(client);
          })
          .catch(() => {
            // Realtime недоступен (например, wsUrl недостижим из браузера) —
            // web-admin/app/chat/page.tsx деградирует до polling, не падает.
          });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось подключиться к чату');
      });
    return () => {
      cancelled = true;
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
    };
  }, [token]);

  return (
    <ChatContext.Provider value={{ ready: !!restClient, error, restClient, realtimeClient, session }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat должен вызываться внутри ChatProvider');
  return ctx;
}
