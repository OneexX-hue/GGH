'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface Member {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  status: string;
  pointsTotal: number;
  roles: { role: { id: string; name: string } }[];
}

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

  return (
    <div>
      <h1>Участники</h1>
      {error && <p className="error">{error}</p>}
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
              <td>{m.email ?? m.phone}</td>
              <td>
                <span className="badge">{m.status}</span>
              </td>
              <td>{m.pointsTotal}</td>
              <td>{m.roles.map((r) => r.role.name).join(', ')}</td>
              <td>
                {m.status !== 'BANNED' && (
                  <button onClick={() => banMember(m.id)}>Заблокировать</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
