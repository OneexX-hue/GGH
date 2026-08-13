'use client';

import { FormEvent, useEffect, useState } from 'react';
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

interface Filters {
  actorUserId: string;
  action: string;
  targetType: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { actorUserId: '', action: '', targetType: '', from: '', to: '' };

function buildQuery(filters: Filters, skip: number): string {
  const params = new URLSearchParams({ skip: String(skip), take: String(PAGE_SIZE) });
  if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
  if (filters.action) params.set('action', filters.action);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.from) params.set('from', new Date(filters.from).toISOString());
  if (filters.to) params.set('to', new Date(filters.to).toISOString());
  return params.toString();
}

export default function AuditLogPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  function loadPage(currentToken: string, skip: number, currentFilters: Filters) {
    apiFetch<AuditLogEntry[]>(`/audit-log?${buildQuery(currentFilters, skip)}`, { token: currentToken })
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
    loadPage(token, 0, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    if (token) loadPage(token, 0, filters);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    if (token) loadPage(token, 0, EMPTY_FILTERS);
  }

  return (
    <div>
      <h1 className="page-title">🗒️ Журнал действий администраторов</h1>
      <p className="page-subtitle">Все административные действия — кто, что и когда сделал</p>

      {error && <p className="error">⚠️ {error}</p>}

      <form onSubmit={applyFilters} className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
        <input
          placeholder="action (например user.ban)"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
        />
        <input
          placeholder="ID актора"
          value={filters.actorUserId}
          onChange={(e) => setFilters((f) => ({ ...f, actorUserId: e.target.value }))}
        />
        <input
          placeholder="Тип объекта (User, MessageReport...)"
          value={filters.targetType}
          onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
        />
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
        />
        <button type="submit" className="btn-primary">
          Применить
        </button>
        <button type="button" className="btn-outline" onClick={resetFilters}>
          Сбросить
        </button>
      </form>

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
          <button
            className="btn-outline"
            style={{ marginTop: 16 }}
            onClick={() => token && loadPage(token, entries.length, filters)}
          >
            Показать ещё
          </button>
        )}
      </div>
    </div>
  );
}
