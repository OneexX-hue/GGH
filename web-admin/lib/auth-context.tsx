'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { apiFetch } from './api';

// MVP-упрощение: токены хранятся в localStorage, а не httpOnly cookie
// (снижает риск XSS-кражи токена в админ-панели) — за это отвечает
// Этап 4, продакшен-готовность.
const ACCESS_TOKEN_KEY = 'carclub_admin_token';
const REFRESH_TOKEN_KEY = 'carclub_admin_refresh_token';
// Держим меньше TTL access-токена на backend (auth.service.ts, issueTokens:
// '15m'), чтобы обновлять его до истечения, а не после.
const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(ACCESS_TOKEN_KEY));
    refreshTokenRef.current = localStorage.getItem(REFRESH_TOKEN_KEY);
    setLoading(false);
  }, []);

  function persistTokens({ accessToken, refreshToken }: TokenPair) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    refreshTokenRef.current = refreshToken;
    setToken(accessToken);
  }

  function clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    refreshTokenRef.current = null;
    setToken(null);
  }

  // Тихое фоновое обновление access-токена, пока открыта вкладка с сессией —
  // без этого refreshToken выпускался бы, но никогда не использовался.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      if (!refreshTokenRef.current) return;
      try {
        const result = await apiFetch<TokenPair>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: refreshTokenRef.current },
        });
        persistTokens(result);
      } catch {
        clearTokens();
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  async function login(identifier: string, password: string, totpCode?: string) {
    const result = await apiFetch<TokenPair>('/auth/login', {
      method: 'POST',
      body: { identifier, password, totpCode },
    });
    persistTokens(result);
  }

  function logout() {
    clearTokens();
  }

  return <AuthContext.Provider value={{ token, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри AuthProvider');
  return ctx;
}
