'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { apiFetch } from './api';
import { RocketChatRestClient } from './rocketchat/rest-client';
import type { RocketChatSession } from './rocketchat/types';

interface ChatContextValue {
  ready: boolean;
  error: string | null;
  restClient: RocketChatRestClient | null;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [restClient, setRestClient] = useState<RocketChatRestClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setRestClient(null);
      return;
    }
    let cancelled = false;
    apiFetch<RocketChatSession>('/chat-bridge/session', { method: 'POST', token })
      .then((session) => {
        if (!cancelled) setRestClient(new RocketChatRestClient(session));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось подключиться к чату');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <ChatContext.Provider value={{ ready: !!restClient, error, restClient }}>{children}</ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat должен вызываться внутри ChatProvider');
  return ctx;
}
