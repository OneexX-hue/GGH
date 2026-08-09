import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch } from './api';

const STORAGE_KEY = 'carclub_access_token';

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      setToken(stored);
      setLoading(false);
    });
  }, []);

  async function persistToken(accessToken: string) {
    await AsyncStorage.setItem(STORAGE_KEY, accessToken);
    setToken(accessToken);
  }

  async function login(identifier: string, password: string) {
    const result = await apiFetch<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    await persistToken(result.accessToken);
  }

  async function register(input: {
    inviteCode: string;
    email?: string;
    phone?: string;
    password: string;
    displayName: string;
  }) {
    const result = await apiFetch<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body: input,
    });
    await persistToken(result.accessToken);
  }

  async function logout() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setToken(null);
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
