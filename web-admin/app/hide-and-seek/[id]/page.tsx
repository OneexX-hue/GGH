'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { apiFetch, ApiError } from '../../../lib/api';

interface Find {
  id: string;
  foundAt: string;
  seeker: { id: string; displayName: string };
}

interface RoundDetail {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  code: string;
  points: number;
  hider: { id: string; displayName: string };
  finds: Find[];
}

interface LeaderboardEntry {
  user: { id: string; displayName: string } | undefined;
  points: number;
  foundAt: string;
}

export default function HideAndSeekDetailPage({ params }: { params: { id: string } }) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [round, setRound] = useState<RoundDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  function loadRound(currentToken: string) {
    apiFetch<RoundDetail>(`/hide-and-seek/rounds/${params.id}`, { token: currentToken })
      .then(setRound)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  function loadLeaderboard(currentToken: string) {
    apiFetch<LeaderboardEntry[]>(`/hide-and-seek/rounds/${params.id}/leaderboard`, { token: currentToken })
      .then(setLeaderboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки лидерборда'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadRound(token);
    loadLeaderboard(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  async function onRegenerateCode() {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/hide-and-seek/rounds/${params.id}/regenerate-code`, { method: 'POST', token });
      loadRound(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось перегенерировать код');
    }
  }

  async function onEndRound() {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/hide-and-seek/rounds/${params.id}`, { method: 'PATCH', token, body: { isActive: false } });
      loadRound(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось завершить раунд');
    }
  }

  if (!round) {
    return (
      <div>
        <h1 className="page-title">🙈 Раунд</h1>
        {error && <p className="error">⚠️ {error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">🙈 {round.title}</h1>
      {error && <p className="error">⚠️ {error}</p>}
      <p className="mb-7 flex items-center gap-3">
        <span className={round.isActive ? 'badge badge-success' : 'badge'}>
          {round.isActive ? '🟢 активен' : '🏁 завершён'}
        </span>
        {round.isActive && (
          <button className="btn-outline" onClick={onEndRound}>
            🏁 Завершить раунд
          </button>
        )}
      </p>

      <h2 className="section-title">🕵️ Кто прячется</h2>
      <div className="card">
        <p className="mb-3">
          <strong>{round.hider.displayName}</strong> — называет код лично, когда его находят.
        </p>
        <p className="flex items-center gap-3">
          Код: <code>{round.code}</code>
          <span>🏆 {round.points} баллов за находку</span>
        </p>
        <button className="btn-outline" style={{ marginTop: 12 }} onClick={onRegenerateCode}>
          🔄 Перегенерировать код
        </button>
      </div>

      <h2 className="section-title">🔎 Кто нашёл</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Участник</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {round.finds.map((find) => (
              <tr key={find.id}>
                <td>{find.seeker.displayName}</td>
                <td className="text-muted-foreground">{new Date(find.foundAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">🏆 Лидерборд раунда</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Участник</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, i) => (
              <tr key={entry.user?.id ?? i}>
                <td>
                  {i === 0 && '🥇 '}
                  {i === 1 && '🥈 '}
                  {i === 2 && '🥉 '}
                  {entry.user?.displayName ?? '—'}
                </td>
                <td>{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
