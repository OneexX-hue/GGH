'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { XIcon } from '../../components/icons';

interface Submission {
  id: string;
  detectedPlate: string | null;
  confidence: number | null;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  points: number | null;
  createdAt: string;
  submittedBy: { id: string; displayName: string };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function PhotoThumb({ id, token }: { id: string; token: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(`${API_BASE_URL}/lpr/submissions/${id}/photo`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('failed'))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, token]);

  if (!src) return <div className="lpr-thumb-placeholder" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Фото номера" className="lpr-thumb" />;
}

export default function LprPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load(currentToken: string) {
    apiFetch<Submission[]>('/lpr/submissions/pending', { token: currentToken })
      .then(setSubmissions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  async function onReview(id: string, decision: 'CONFIRMED' | 'REJECTED') {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/lpr/submissions/${id}/review`, { method: 'POST', token, body: { decision } });
      load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось рассмотреть заявку');
    }
  }

  return (
    <div>
      <h1 className="page-title">🚘 Распознавание номеров</h1>
      <p className="page-subtitle">Спорные распознавания (низкая уверенность) — подтвердить или отклонить вручную</p>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Фото</th>
              <th>Номер</th>
              <th>Уверенность</th>
              <th>Участник</th>
              <th>Подано</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>{token && <PhotoThumb id={s.id} token={token} />}</td>
                <td>{s.detectedPlate ?? '—'}</td>
                <td className="text-muted-foreground">
                  {s.confidence !== null ? `${Math.round(s.confidence * 100)}%` : '—'}
                </td>
                <td>{s.submittedBy.displayName}</td>
                <td className="text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="flex gap-2">
                  <button onClick={() => onReview(s.id, 'CONFIRMED')}>✅ Подтвердить</button>
                  <button
                    className="icon-btn-danger"
                    onClick={() => onReview(s.id, 'REJECTED')}
                    title="Отклонить"
                    aria-label="Отклонить"
                  >
                    <XIcon size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground">
                  Нет заявок, ожидающих модерации
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
