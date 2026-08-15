'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { PhoneIcon, VideoIcon } from '../../components/icons';

type CallKind = 'AUDIO' | 'VIDEO';
type CallStatus = 'COMPLETED' | 'MISSED' | 'REJECTED' | 'FAILED';

interface CallHistoryEntry {
  id: string;
  kind: CallKind;
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
  caller: { id: string; displayName: string };
  callee: { id: string; displayName: string };
}

const STATUS_LABEL: Record<CallStatus, string> = {
  COMPLETED: 'Завершён',
  MISSED: 'Пропущен',
  REJECTED: 'Отклонён',
  FAILED: 'Не удался (собеседник офлайн)',
};

const STATUS_BADGE: Record<CallStatus, string> = {
  COMPLETED: 'badge badge-success',
  MISSED: 'badge',
  REJECTED: 'badge badge-danger',
  FAILED: 'badge badge-danger',
};

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const seconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallsHistoryPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<CallHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  function loadPage(currentToken: string, skip: number) {
    apiFetch<CallHistoryEntry[]>(`/calls/history?skip=${skip}&take=30`, { token: currentToken })
      .then((page) => {
        setEntries((prev) => (skip === 0 ? page : [...prev, ...page]));
        setHasMore(page.length === 30);
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
      <h1 className="page-title">📞 История звонков</h1>
      <p className="page-subtitle">
        WebRTC-звонки (аудио/видео) — только 1:1, история собственных входящих и исходящих.
      </p>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Звонящий</th>
              <th>Получатель</th>
              <th>Статус</th>
              <th>Длительность</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.kind === 'VIDEO' ? <VideoIcon size={15} /> : <PhoneIcon size={15} />}</td>
                <td>{entry.caller.displayName}</td>
                <td>{entry.callee.displayName}</td>
                <td>
                  <span className={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</span>
                </td>
                <td className="text-muted-foreground">{formatDuration(entry.startedAt, entry.endedAt)}</td>
                <td className="text-muted-foreground">{new Date(entry.startedAt).toLocaleString()}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground">
                  Звонков пока не было
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
