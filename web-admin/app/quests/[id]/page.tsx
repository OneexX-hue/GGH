'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { apiFetch, ApiError } from '../../../lib/api';

interface Checkpoint {
  id: string;
  title: string;
  description: string | null;
  code: string;
  points: number;
  order: number;
}

interface QuestDetail {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  checkpoints: Checkpoint[];
}

interface LeaderboardEntry {
  user: { id: string; displayName: string } | undefined;
  points: number;
}

export default function QuestDetailPage({ params }: { params: { id: string } }) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [cpTitle, setCpTitle] = useState('');
  const [cpPoints, setCpPoints] = useState('10');
  const [error, setError] = useState<string | null>(null);

  function loadQuest(currentToken: string) {
    apiFetch<QuestDetail>(`/quests/${params.id}`, { token: currentToken })
      .then(setQuest)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  function loadLeaderboard(currentToken: string) {
    apiFetch<LeaderboardEntry[]>(`/quests/${params.id}/leaderboard`, { token: currentToken })
      .then(setLeaderboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки лидерборда'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadQuest(token);
    loadLeaderboard(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  async function onAddCheckpoint(e: FormEvent) {
    e.preventDefault();
    if (!token || !cpTitle) return;
    setError(null);
    try {
      await apiFetch(`/quests/${params.id}/checkpoints`, {
        method: 'POST',
        token,
        body: { title: cpTitle, points: Number(cpPoints) },
      });
      setCpTitle('');
      setCpPoints('10');
      loadQuest(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить чекпоинт');
    }
  }

  async function onRegenerateCode(checkpointId: string) {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/quests/${params.id}/checkpoints/${checkpointId}/regenerate-code`, { method: 'POST', token });
      loadQuest(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось перегенерировать код');
    }
  }

  async function onEndQuest() {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/quests/${params.id}`, { method: 'PATCH', token, body: { isActive: false } });
      loadQuest(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось завершить квест');
    }
  }

  if (!quest) {
    return (
      <div>
        <h1>Квест</h1>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1>{quest.title}</h1>
      {error && <p className="error">{error}</p>}
      <p>
        <span className="badge">{quest.isActive ? 'активен' : 'завершён'}</span>{' '}
        {quest.isActive && <button onClick={onEndQuest}>Завершить квест</button>}
      </p>

      <h2>Чекпоинты</h2>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Код</th>
            <th>Баллы</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {quest.checkpoints.map((cp) => (
            <tr key={cp.id}>
              <td>{cp.title}</td>
              <td>
                <code>{cp.code}</code>
              </td>
              <td>{cp.points}</td>
              <td>
                <button onClick={() => onRegenerateCode(cp.id)}>Перегенерировать код</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={onAddCheckpoint} className="form-row" style={{ marginTop: 16 }}>
        <input value={cpTitle} onChange={(e) => setCpTitle(e.target.value)} placeholder="Название чекпоинта" />
        <input
          type="number"
          min={1}
          value={cpPoints}
          onChange={(e) => setCpPoints(e.target.value)}
          placeholder="Баллы"
        />
        <button type="submit">Добавить чекпоинт</button>
      </form>

      <h2 style={{ marginTop: 32 }}>Лидерборд квеста</h2>
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
              <td>{entry.user?.displayName ?? '—'}</td>
              <td>{entry.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
