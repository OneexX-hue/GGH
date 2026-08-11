'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface Invite {
  id: string;
  code: string;
  type: 'SINGLE_USE' | 'MULTI_USE' | 'PERSONAL';
  usesCount: number;
  maxUses: number | null;
  revokedAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<Invite['type'], string> = {
  SINGLE_USE: 'Одноразовый',
  MULTI_USE: 'Многоразовый',
  PERSONAL: 'Персональный',
};

export default function InvitesPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [type, setType] = useState<Invite['type']>('SINGLE_USE');
  const [maxUses, setMaxUses] = useState('5');
  const [personalContact, setPersonalContact] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadInvites(currentToken: string) {
    apiFetch<Invite[]>('/invites', { token: currentToken })
      .then(setInvites)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadInvites(token);
  }, [token, loading, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await apiFetch('/invites', {
        method: 'POST',
        token,
        body: {
          type,
          maxUses: type === 'MULTI_USE' ? Number(maxUses) : undefined,
          personalContact: type === 'PERSONAL' ? personalContact : undefined,
        },
      });
      loadInvites(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать инвайт');
    }
  }

  async function onRevoke(id: string) {
    if (!token) return;
    await apiFetch(`/invites/${id}/revoke`, { method: 'POST', token });
    loadInvites(token);
  }

  return (
    <div>
      <h1 className="page-title">✉️ Приглашения</h1>
      <p className="page-subtitle">Инвайт-коды для вступления в клуб</p>

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={onCreate}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <select value={type} onChange={(e) => setType(e.target.value as Invite['type'])}>
              <option value="SINGLE_USE">Одноразовый</option>
              <option value="MULTI_USE">Многоразовый (с лимитом)</option>
              <option value="PERSONAL">Персональный</option>
            </select>
            {type === 'MULTI_USE' && (
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Лимит использований"
              />
            )}
            {type === 'PERSONAL' && (
              <input
                value={personalContact}
                onChange={(e) => setPersonalContact(e.target.value)}
                placeholder="email или телефон"
              />
            )}
            <button type="submit">✨ Создать инвайт</button>
          </div>
        </form>
      </div>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Код</th>
              <th>Тип</th>
              <th>Использован</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <code>{inv.code}</code>
                </td>
                <td className="text-muted-foreground">{TYPE_LABEL[inv.type]}</td>
                <td>
                  {inv.usesCount}
                  {inv.maxUses ? ` / ${inv.maxUses}` : ''}
                </td>
                <td>
                  <span className={inv.revokedAt ? 'badge badge-danger' : 'badge badge-success'}>
                    {inv.revokedAt ? 'отозван' : 'активен'}
                  </span>
                </td>
                <td>
                  {!inv.revokedAt && (
                    <button className="btn-outline" onClick={() => onRevoke(inv.id)}>
                      Отозвать
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
