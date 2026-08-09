'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { key: string } }[];
}

export default function RolesPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadRoles(currentToken: string) {
    apiFetch<Role[]>('/roles', { token: currentToken })
      .then(setRoles)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadRoles(token);
  }, [token, loading, router]);

  async function onCreateRole(e: FormEvent) {
    e.preventDefault();
    if (!token || !newRoleName) return;
    try {
      await apiFetch('/roles', { method: 'POST', token, body: { name: newRoleName } });
      setNewRoleName('');
      loadRoles(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать роль');
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (!token || !assignUserId || !assignRoleId) return;
    try {
      await apiFetch(`/roles/${assignRoleId}/assign`, {
        method: 'POST',
        token,
        body: { userId: assignUserId },
      });
      setAssignUserId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось назначить роль');
    }
  }

  return (
    <div>
      <h1>Роли</h1>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Системная</th>
            <th>Права</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.isSystem ? 'да' : 'нет'}</td>
              <td>{r.permissions.map((p) => p.permission.key).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Создать роль</h2>
      <form onSubmit={onCreateRole} className="form-row">
        <input
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          placeholder="Название роли"
        />
        <button type="submit">Создать</button>
      </form>

      <h2 style={{ marginTop: 32 }}>Назначить роль участнику</h2>
      <form onSubmit={onAssign} className="form-row">
        <input
          value={assignUserId}
          onChange={(e) => setAssignUserId(e.target.value)}
          placeholder="ID участника"
        />
        <select value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}>
          <option value="">Выберите роль</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit">Назначить</button>
      </form>
    </div>
  );
}
