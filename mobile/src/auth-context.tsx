import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { apiFetch } from './api';

const ACCESS_TOKEN_KEY = 'carclub_access_token';
const REFRESH_TOKEN_KEY = 'carclub_refresh_token';
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
  register: (input: {
    inviteCode: string;
    email?: string;
    phone?: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const [storedAccess, storedRefresh] = await Promise.all([
        AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
      ]);
      refreshTokenRef.current = storedRefresh;
      setToken(storedAccess);
      setLoading(false);
    })();
  }, []);

  async function persistTokens({ accessToken, refreshToken }: TokenPair) {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken],
    ]);
    refreshTokenRef.current = refreshToken;
    setToken(accessToken);
  }

  async function clearTokens() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    refreshTokenRef.current = null;
    setToken(null);
  }

  // Тихое фоновое обновление access-токена, пока приложение открыто с
  // активной сессией — без этого refreshToken выпускался бы, но никогда не
  // использовался, и пользователю пришлось бы логиниться каждые 15 минут.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      if (!refreshTokenRef.current) return;
      try {
        const result = await apiFetch<TokenPair>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: refreshTokenRef.current },
        });
        await persistTokens(result);
      } catch {
        await clearTokens();
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  async function login(identifier: string, password: string, totpCode?: string) {
    const result = await apiFetch<TokenPair>('/auth/login', {
      method: 'POST',
      body: { identifier, password, totpCode },
    });
    await persistTokens(result);
  }

  async function register(input: {
    inviteCode: string;
    email?: string;
    phone?: string;
    password: string;
    displayName: string;
  }) {
    const result = await apiFetch<TokenPair>('/auth/register', {
      method: 'POST',
      body: input,
    });
    await persistTokens(result);
  }

  async function logout() {
    await clearTokens();
  }

  return (
    <AuthContext.Provider value={{ token, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри AuthProvider');
  return ctx;
}
