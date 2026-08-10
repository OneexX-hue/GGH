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
    <div style={{ maxWidth: 360 }}>
      <h1>Вход в админ-панель</h1>
      <form onSubmit={onSubmit}>
        <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label>Email / телефон</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label>Пароль</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <label>Код 2FA (если включена)</label>
          <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
