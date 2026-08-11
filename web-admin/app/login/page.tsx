'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password, totpCode || undefined);
      router.push('/members');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center">
      <div className="card w-full max-w-sm">
        <div className="mb-1 text-3xl">🏁</div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Вход в админ-панель
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          CarClub Platform
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Email / телефон
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            🔐 Код 2FA (если включена)
            <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
          </label>
          {error && <p className="error">⚠️ {error}</p>}
          <button type="submit" disabled={submitting} className="mt-1">
            {submitting ? 'Входим…' : '🔑 Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
