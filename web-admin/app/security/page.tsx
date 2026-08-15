'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { ShieldLockIcon } from '../../components/icons';

interface Me {
  id: string;
  displayName: string;
  twoFactorEnabled: boolean;
}

export default function SecurityPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function loadMe(currentToken: string) {
    apiFetch<Me>('/users/me', { token: currentToken })
      .then(setMe)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadMe(token);
  }, [token, loading, router]);

  async function onStart() {
    if (!token) return;
    setError(null);
    try {
      const result = await apiFetch<{ secret: string; otpauthUrl: string }>('/auth/2fa/start', {
        method: 'POST',
        token,
      });
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось начать подключение 2FA');
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!token || !code) return;
    setError(null);
    try {
      await apiFetch('/auth/2fa/confirm', { method: 'POST', token, body: { code } });
      setConfirmed(true);
      setCode('');
      loadMe(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Неверный код подтверждения');
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 className="page-title">
        <ShieldLockIcon size={22} /> Безопасность
      </h1>
      <p className="page-subtitle">Двухфакторная аутентификация аккаунта</p>
      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        {me && (
          <p className="mb-3 flex items-center gap-3">
            <span>Статус 2FA:</span>
            <span className={me.twoFactorEnabled ? 'badge badge-success' : 'badge'}>
              {me.twoFactorEnabled ? '✅ включена' : '⭕ выключена'}
            </span>
          </p>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          Обязательна для выполнения административных действий (управление
          участниками, ролями, приглашениями, модерация чата, журнал аудита) —
          без неё соответствующие запросы будут отклонены с 403, даже если у
          роли есть нужное право.
        </p>

        {!me?.twoFactorEnabled && !secret && (
          <button onClick={onStart}>
            <ShieldLockIcon size={14} /> Начать подключение 2FA
          </button>
        )}

        {secret && !me?.twoFactorEnabled && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Добавьте ключ в приложение-аутентификатор (Google Authenticator,
              Authy и т.п.) вручную — введите секрет ниже как TOTP-ключ, либо
              используйте полную ссылку, если ваше приложение поддерживает
              импорт по URL:
            </p>
            <p>
              Секрет: <code>{secret}</code>
            </p>
            <p className="break-all">
              Ссылка: <code>{otpauthUrl}</code>
            </p>
            <form onSubmit={onConfirm} className="form-row" style={{ marginBottom: 0 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Код из приложения (6 цифр)"
                maxLength={6}
              />
              <button type="submit">✅ Подтвердить</button>
            </form>
          </div>
        )}

        {confirmed && <p className="notice mt-4">🎉 2FA успешно включена.</p>}
      </div>
    </div>
  );
}
