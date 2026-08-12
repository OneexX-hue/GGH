'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; displayName: string } | null;
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  function loadPage(currentToken: string, skip: number) {
    apiFetch<AuditLogEntry[]>(`/audit-log?skip=${skip}&take=${PAGE_SIZE}`, { token: currentToken })
      .then((page) => {
        setEntries((prev) => (skip === 0 ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadPage(token, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  return (
    <div>
      <h1 className="page-title">🗒️ Журнал действий администраторов</h1>
      <p className="page-subtitle">Все административные действия — кто, что и когда сделал</p>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Действие</th>
              <th>Кто</th>
              <th>Объект</th>
              <th>IP</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <code>{entry.action}</code>
                </td>
                <td>{entry.actor?.displayName ?? '—'}</td>
                <td className="text-muted-foreground">
                  {entry.targetType ? `${entry.targetType}${entry.targetId ? ` · ${entry.targetId}` : ''}` : '—'}
                </td>
                <td className="text-muted-foreground">{entry.ipAddress ?? '—'}</td>
                <td className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground">
                  Записей пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {hasMore && entries.length > 0 && (
          <button className="btn-outline" style={{ marginTop: 16 }} onClick={() => token && loadPage(token, entries.length)}>
            Показать ещё
          </button>
        )}
      </div>
    </div>
  );
}
