'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { XIcon, CheckDoubleIcon } from '../../components/icons';

interface Member {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  status: string;
  pointsTotal: number;
  roles: { role: { id: string; name: string } }[];
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge badge-success',
  BANNED: 'badge badge-danger',
  PENDING: 'badge badge-primary',
};

export default function MembersPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    apiFetch<Member[]>('/users', { token })
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }, [token, loading, router]);

  async function banMember(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/users/${id}/ban`, { method: 'POST', token });
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'BANNED' } : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось заблокировать');
    }
  }

  async function unbanMember(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/users/${id}/unban`, { method: 'POST', token });
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'ACTIVE' } : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось разблокировать');
    }
  }

  return (
    <div>
      <h1 className="page-title">👥 Участники</h1>
      <p className="page-subtitle">Список аккаунтов клуба, баллы и роли</p>
      {error && <p className="error">⚠️ {error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Контакт</th>
              <th>Статус</th>
              <th>Баллы</th>
              <th>Роли</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.displayName}</td>
                <td className="text-muted-foreground">{m.email ?? m.phone}</td>
                <td>
                  <span className={STATUS_BADGE[m.status] ?? 'badge'}>{m.status}</span>
                </td>
                <td>🏆 {m.pointsTotal}</td>
                <td className="text-muted-foreground">{m.roles.map((r) => r.role.name).join(', ') || '—'}</td>
                <td>
                  {m.status !== 'BANNED' ? (
                    <button
                      className="icon-btn-danger"
                      onClick={() => banMember(m.id)}
                      title="Заблокировать"
                      aria-label="Заблокировать"
                    >
                      <XIcon size={15} />
                    </button>
                  ) : (
                    <button
                      className="icon-btn"
                      onClick={() => unbanMember(m.id)}
                      title="Разблокировать"
                      aria-label="Разблокировать"
                    >
                      <CheckDoubleIcon size={15} />
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
