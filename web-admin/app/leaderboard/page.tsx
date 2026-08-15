'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface LeaderboardEntry {
  user: { id: string; displayName: string; avatarUrl: string | null } | undefined;
  points: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    apiFetch<LeaderboardEntry[]>('/modules/leaderboard/overall?limit=50', { token })
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }, [token, loading, router]);

  return (
    <div>
      <h1 className="page-title">🏆 Общий лидерборд клуба</h1>
      <p className="page-subtitle">Сумма баллов по всем игровым модулям сразу</p>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Участник</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.user?.id ?? i}>
                <td>{MEDAL[i] ?? i + 1}</td>
                <td>{entry.user?.displayName ?? '—'}</td>
                <td>{entry.points}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted-foreground">
                  Пока нет начислений
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
