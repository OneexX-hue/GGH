'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { TrashIcon, XIcon, BellOffIcon, CheckDoubleIcon } from '../../components/icons';

type RoomType = 'd' | 'p' | 'c';

interface Room {
  _id: string;
  t: RoomType;
  name?: string;
  fname?: string;
  msgs?: number;
  usersCount?: number;
}

interface Message {
  _id: string;
  msg: string;
  ts: string;
  u: { _id: string; username: string; name?: string };
}

type AccessAction = 'VIEW' | 'DOWNLOAD_ATTEMPT' | 'SCREENSHOT_DETECTED';

interface AccessLogEntry {
  id: string;
  action: AccessAction;
  createdAt: string;
  media: { id: string; kind: 'PHOTO' | 'VIDEO'; uploader: { id: string; displayName: string } };
  viewer: { id: string; displayName: string };
}

type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

interface MessageReport {
  id: string;
  roomId: string;
  msgId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporter: { id: string; displayName: string };
}

const ROOM_TYPE_LABEL: Record<RoomType, string> = { d: '💬 личка', p: '👥 группа', c: '📢 канал' };
const ACTION_LABEL: Record<AccessAction, string> = {
  VIEW: '👁️ VIEW',
  DOWNLOAD_ATTEMPT: '⬇️ DOWNLOAD_ATTEMPT',
  SCREENSHOT_DETECTED: '📸 SCREENSHOT_DETECTED',
};

export default function ModerationPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [accessFilter, setAccessFilter] = useState<AccessAction | ''>('');
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [reportFilter, setReportFilter] = useState<ReportStatus>('OPEN');
  const [error, setError] = useState<string | null>(null);

  function loadRooms(currentToken: string) {
    apiFetch<Room[]>('/moderation/rooms', { token: currentToken })
      .then(setRooms)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки комнат'));
  }

  function loadAccessLog(currentToken: string, action: AccessAction | '') {
    const query = action ? `?action=${action}` : '';
    apiFetch<AccessLogEntry[]>(`/media/access-log${query}`, { token: currentToken })
      .then(setAccessLog)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки журнала'));
  }

  function loadReports(currentToken: string, status: ReportStatus) {
    apiFetch<MessageReport[]>(`/moderation/reports?status=${status}`, { token: currentToken })
      .then(setReports)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки жалоб'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadRooms(token);
    loadAccessLog(token, accessFilter);
    loadReports(token, reportFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  function selectRoom(room: Room) {
    if (!token) return;
    setSelectedRoom(room);
    setError(null);
    apiFetch<Message[]>(`/moderation/rooms/${room._id}/messages?roomType=${room.t}`, { token })
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки сообщений'));
  }

  async function deleteMessage(msgId: string) {
    if (!token || !selectedRoom) return;
    try {
      await apiFetch(`/moderation/rooms/${selectedRoom._id}/messages/${msgId}`, { method: 'DELETE', token });
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить сообщение');
    }
  }

  async function banSender(msgId: string, rocketChatUserId: string) {
    if (!token || !selectedRoom) return;
    if (!confirm('Забанить отправителя этого сообщения? Личность не раскрывается — бан по самому сообщению.')) return;
    try {
      await apiFetch(`/moderation/rooms/${selectedRoom._id}/messages/${msgId}/ban-sender`, {
        method: 'POST',
        token,
        body: { rocketChatUserId },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось забанить отправителя');
    }
  }

  async function muteSender(username: string) {
    if (!token || !selectedRoom) return;
    try {
      await apiFetch(`/moderation/rooms/${selectedRoom._id}/mute?roomType=${selectedRoom.t}`, {
        method: 'POST',
        token,
        body: { username },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось замьютить отправителя');
    }
  }

  function onAccessFilterChange(action: AccessAction | '') {
    setAccessFilter(action);
    if (token) loadAccessLog(token, action);
  }

  async function deleteMedia(mediaId: string) {
    if (!token) return;
    if (!confirm('Удалить этот медиафайл? Действие необратимо.')) return;
    try {
      await apiFetch(`/media/${mediaId}`, { method: 'DELETE', token });
      setAccessLog((prev) => prev.filter((entry) => entry.media.id !== mediaId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить медиафайл');
    }
  }

  function onReportFilterChange(status: ReportStatus) {
    setReportFilter(status);
    if (token) loadReports(token, status);
  }

  async function resolveReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
    if (!token) return;
    try {
      await apiFetch(`/moderation/reports/${id}/resolve`, { method: 'POST', token, body: { status } });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось обработать жалобу');
    }
  }

  return (
    <div>
      <h1 className="page-title">💬 Модерация</h1>
      <p className="page-subtitle">Комнаты чата и журнал доступа к защищённым медиа</p>
      {error && <p className="error">⚠️ {error}</p>}

      <h2 className="section-title">🏠 Комнаты чата</h2>
      <div className="flex gap-6 flex-wrap">
        <div className="card" style={{ maxWidth: 440, flex: '1 1 380px' }}>
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Сообщений</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room._id}>
                  <td>{room.fname ?? room.name ?? room._id}</td>
                  <td className="text-muted-foreground">{ROOM_TYPE_LABEL[room.t]}</td>
                  <td>{room.msgs ?? '—'}</td>
                  <td>
                    <button className="btn-outline" onClick={() => selectRoom(room)}>
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedRoom && (
          <div className="card" style={{ flex: '1 1 420px' }}>
            <h3 className="mb-3 font-bold">💬 {selectedRoom.fname ?? selectedRoom.name ?? selectedRoom._id}</h3>
            <table>
              <thead>
                <tr>
                  <th>Автор</th>
                  <th>Текст</th>
                  <th>Время</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m._id}>
                    <td>{m.u.name ?? m.u.username}</td>
                    <td>{m.msg}</td>
                    <td className="text-muted-foreground">{new Date(m.ts).toLocaleString()}</td>
                    <td className="flex gap-2">
                      <button
                        className="icon-btn-danger"
                        onClick={() => deleteMessage(m._id)}
                        title="Удалить сообщение"
                        aria-label="Удалить сообщение"
                      >
                        <TrashIcon size={15} />
                      </button>
                      {/* Мут — модерация по комнате, у Rocket.Chat её нет для личных
                          сообщений (roomType 'd'), поэтому кнопка не показывается там,
                          а не дизейблится с фальшивым обещанием (см. CLAUDE.md, "не
                          оставлять нерабочие кнопки"). */}
                      {selectedRoom.t !== 'd' && (
                        <button
                          className="icon-btn"
                          onClick={() => muteSender(m.u.username)}
                          title="Замьютить отправителя в этой комнате"
                          aria-label="Замьютить отправителя в этой комнате"
                        >
                          <BellOffIcon size={15} />
                        </button>
                      )}
                      <button
                        className="icon-btn-danger"
                        onClick={() => banSender(m._id, m.u._id)}
                        title="Забанить отправителя"
                        aria-label="Забанить отправителя"
                      >
                        <XIcon size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="section-title">🖼️ Журнал доступа к медиа</h2>
      <div className="form-row">
        <select value={accessFilter} onChange={(e) => onAccessFilterChange(e.target.value as AccessAction | '')}>
          <option value="">Все события</option>
          <option value="VIEW">Просмотр</option>
          <option value="DOWNLOAD_ATTEMPT">Попытка скачивания</option>
          <option value="SCREENSHOT_DETECTED">Скриншот обнаружен</option>
        </select>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Событие</th>
              <th>Кто просматривал</th>
              <th>Автор медиа</th>
              <th>Тип</th>
              <th>Когда</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accessLog.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className={entry.action === 'SCREENSHOT_DETECTED' ? 'badge badge-danger' : 'badge'}>
                    {ACTION_LABEL[entry.action]}
                  </span>
                </td>
                <td>{entry.viewer.displayName}</td>
                <td className="text-muted-foreground">{entry.media.uploader.displayName}</td>
                <td>{entry.media.kind === 'PHOTO' ? '📷 PHOTO' : '🎬 VIDEO'}</td>
                <td className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
                <td>
                  <button
                    className="icon-btn-danger"
                    onClick={() => deleteMedia(entry.media.id)}
                    title="Удалить медиафайл"
                    aria-label="Удалить медиафайл"
                  >
                    <TrashIcon size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">🚩 Жалобы на сообщения</h2>
      <div className="form-row">
        <select value={reportFilter} onChange={(e) => onReportFilterChange(e.target.value as ReportStatus)}>
          <option value="OPEN">Открытые</option>
          <option value="RESOLVED">Обработанные</option>
          <option value="DISMISSED">Отклонённые</option>
        </select>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Комната</th>
              <th>Причина</th>
              <th>Кто пожаловался</th>
              <th>Когда</th>
              {reportFilter === 'OPEN' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground">
                  Нет жалоб в этом статусе
                </td>
              </tr>
            )}
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="text-muted-foreground">{r.roomId}</td>
                <td>{r.reason}</td>
                <td>{r.reporter.displayName}</td>
                <td className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                {reportFilter === 'OPEN' && (
                  <td className="flex gap-2">
                    <button
                      className="icon-btn"
                      onClick={() => resolveReport(r.id, 'RESOLVED')}
                      title="Отметить обработанной"
                      aria-label="Отметить обработанной"
                    >
                      <CheckDoubleIcon size={15} />
                    </button>
                    <button
                      className="icon-btn-danger"
                      onClick={() => resolveReport(r.id, 'DISMISSED')}
                      title="Отклонить жалобу"
                      aria-label="Отклонить жалобу"
                    >
                      <XIcon size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
