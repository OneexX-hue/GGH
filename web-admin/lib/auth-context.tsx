'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch } from './api';

// MVP-упрощение: токен хранится в localStorage. Для продакшена (Этап 4,
// продакшен-готовность) заменить на httpOnly cookie + refresh-эндпоинт,
// чтобы снизить риск XSS-кражи токена в админ-панели.
const STORAGE_KEY = 'carclub_admin_token';

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

  useEffect(() => {
    setToken(localStorage.getItem(STORAGE_KEY));
    setLoading(false);
  }, []);

  async function login(identifier: string, password: string, totpCode?: string) {
    const result = await apiFetch<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { identifier, password, totpCode },
    });
    localStorage.setItem(STORAGE_KEY, result.accessToken);
    setToken(result.accessToken);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }

  return <AuthContext.Provider value={{ token, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри AuthProvider');
  return ctx;
}
