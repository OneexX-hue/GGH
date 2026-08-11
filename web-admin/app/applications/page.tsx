'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface Application {
  id: string;
  applicantName: string;
  contact: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
}

type StatusFilter = Application['status'] | '';

const STATUS_BADGE: Record<Application['status'], string> = {
  PENDING: 'badge badge-primary',
  APPROVED: 'badge badge-success',
  REJECTED: 'badge badge-danger',
};

export default function ApplicationsPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ applicantName: string; code: string } | null>(null);

  function loadApplications(currentToken: string, status: StatusFilter) {
    const query = status ? `?status=${status}` : '';
    apiFetch<Application[]>(`/applications${query}`, { token: currentToken })
      .then(setApplications)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadApplications(token, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  function onStatusFilterChange(status: StatusFilter) {
    setStatusFilter(status);
    if (token) loadApplications(token, status);
  }

  async function onReview(app: Application, decision: 'APPROVED' | 'REJECTED') {
    if (!token) return;
    setError(null);
    try {
      const result = await apiFetch<{ application: Application; issuedInviteCode?: string }>(
        `/applications/${app.id}/review`,
        { method: 'POST', token, body: { decision } },
      );
      if (result.issuedInviteCode) {
        setIssuedCode({ applicantName: app.applicantName, code: result.issuedInviteCode });
      }
      loadApplications(token, statusFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось рассмотреть заявку');
    }
  }

  return (
    <div>
      <h1 className="page-title">📝 Заявки на вступление</h1>
      <p className="page-subtitle">Заявки без инвайт-кода — на рассмотрении администратора</p>

      {error && <p className="error">⚠️ {error}</p>}
      {issuedCode && (
        <p className="notice">
          ✅ Заявка «{issuedCode.applicantName}» одобрена — выдан инвайт-код: <code>{issuedCode.code}</code>
        </p>
      )}

      <div className="form-row">
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}>
          <option value="">Все заявки</option>
          <option value="PENDING">На рассмотрении</option>
          <option value="APPROVED">Одобренные</option>
          <option value="REJECTED">Отклонённые</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Контакт</th>
              <th>Статус</th>
              <th>Подана</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td>{app.applicantName}</td>
                <td className="text-muted-foreground">{app.contact}</td>
                <td>
                  <span className={STATUS_BADGE[app.status]}>{app.status}</span>
                </td>
                <td className="text-muted-foreground">{new Date(app.createdAt).toLocaleString()}</td>
                <td>
                  {app.status === 'PENDING' && (
                    <span className="inline-flex gap-2">
                      <button onClick={() => onReview(app, 'APPROVED')}>✅ Одобрить</button>
                      <button className="btn-danger" onClick={() => onReview(app, 'REJECTED')}>
                        ❌ Отклонить
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
