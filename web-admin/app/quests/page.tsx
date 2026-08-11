'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface Quest {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  _count: { checkpoints: number };
}

export default function QuestsPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadQuests(currentToken: string) {
    apiFetch<Quest[]>('/quests', { token: currentToken })
      .then(setQuests)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadQuests(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !title) return;
    setError(null);
    try {
      await apiFetch('/quests', { method: 'POST', token, body: { title, description: description || undefined } });
      setTitle('');
      setDescription('');
      loadQuests(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать квест');
    }
  }

  return (
    <div>
      <h1 className="page-title">🗺️ Квесты</h1>
      <p className="page-subtitle">Авто-квест — чекпоинты по секретным кодам</p>
      {error && <p className="error">⚠️ {error}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={onCreate} className="form-row" style={{ marginBottom: 0 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название квеста" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание (опц.)" />
          <button type="submit">✨ Создать</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Статус</th>
              <th>Чекпоинтов</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quests.map((quest) => (
              <tr key={quest.id}>
                <td>{quest.title}</td>
                <td>
                  <span className={quest.isActive ? 'badge badge-success' : 'badge'}>
                    {quest.isActive ? '🟢 активен' : '🏁 завершён'}
                  </span>
                </td>
                <td>📍 {quest._count.checkpoints}</td>
                <td>
                  <Link href={`/quests/${quest.id}`} className="btn-outline no-underline">
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
