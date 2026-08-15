'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { PlusIcon } from '../../components/icons';

interface Round {
  id: string;
  title: string;
  isActive: boolean;
  points: number;
  hider: { id: string; displayName: string };
  _count: { finds: number };
}

interface Member {
  id: string;
  displayName: string;
}

export default function HideAndSeekPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [hiderUserId, setHiderUserId] = useState('');
  const [points, setPoints] = useState('20');
  const [error, setError] = useState<string | null>(null);

  function loadRounds(currentToken: string) {
    apiFetch<Round[]>('/hide-and-seek/rounds', { token: currentToken })
      .then(setRounds)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadRounds(token);
    apiFetch<Member[]>('/users', { token }).then(setMembers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !title || !hiderUserId) return;
    setError(null);
    try {
      await apiFetch('/hide-and-seek/rounds', {
        method: 'POST',
        token,
        body: { title, hiderUserId, points: Number(points) },
      });
      setTitle('');
      setHiderUserId('');
      setPoints('20');
      loadRounds(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать раунд');
    }
  }

  return (
    <div>
      <h1 className="page-title">🙈 Прятки</h1>
      <p className="page-subtitle">Один участник прячется и лично называет код найденному</p>
      {error && <p className="error">⚠️ {error}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={onCreate} className="form-row" style={{ marginBottom: 0 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название раунда" />
          <select value={hiderUserId} onChange={(e) => setHiderUserId(e.target.value)}>
            <option value="">Кто прячется?</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Баллы"
          />
          <button type="submit">
            <PlusIcon size={14} /> Создать
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Прячется</th>
              <th>Статус</th>
              <th>Найден раз</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round.id}>
                <td>{round.title}</td>
                <td>{round.hider.displayName}</td>
                <td>
                  <span className={round.isActive ? 'badge badge-success' : 'badge'}>
                    {round.isActive ? '🟢 активен' : '🏁 завершён'}
                  </span>
                </td>
                <td>🔎 {round._count.finds}</td>
                <td>
                  <Link href={`/hide-and-seek/${round.id}`} className="btn-outline no-underline">
                    Открыть →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
