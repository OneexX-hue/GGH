'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

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
  u: { username: string; name?: string };
}

type AccessAction = 'VIEW' | 'DOWNLOAD_ATTEMPT' | 'SCREENSHOT_DETECTED';

interface AccessLogEntry {
  id: string;
  action: AccessAction;
  createdAt: string;
  media: { id: string; kind: 'PHOTO' | 'VIDEO'; uploader: { id: string; displayName: string } };
  viewer: { id: string; displayName: string };
}

const ROOM_TYPE_LABEL: Record<RoomType, string> = { d: 'личка', p: 'группа', c: 'канал' };

export default function ModerationPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [accessFilter, setAccessFilter] = useState<AccessAction | ''>('');
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

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadRooms(token);
    loadAccessLog(token, accessFilter);
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

  function onAccessFilterChange(action: AccessAction | '') {
    setAccessFilter(action);
    if (token) loadAccessLog(token, action);
  }

  return (
    <div>
      <h1>Модерация</h1>
      {error && <p className="error">{error}</p>}

      <h2>Комнаты чата</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <table style={{ maxWidth: 420 }}>
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
                <td>{ROOM_TYPE_LABEL[room.t]}</td>
                <td>{room.msgs ?? '—'}</td>
                <td>
                  <button onClick={() => selectRoom(room)}>Открыть</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedRoom && (
          <div style={{ flex: 1 }}>
            <h3>Сообщения: {selectedRoom.fname ?? selectedRoom.name ?? selectedRoom._id}</h3>
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
                    <td>{new Date(m.ts).toLocaleString()}</td>
                    <td>
                      <button onClick={() => deleteMessage(m._id)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 style={{ marginTop: 32 }}>Журнал доступа к медиа</h2>
      <div className="form-row">
        <select value={accessFilter} onChange={(e) => onAccessFilterChange(e.target.value as AccessAction | '')}>
          <option value="">Все события</option>
          <option value="VIEW">Просмотр</option>
          <option value="DOWNLOAD_ATTEMPT">Попытка скачивания</option>
          <option value="SCREENSHOT_DETECTED">Скриншот обнаружен</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Событие</th>
            <th>Кто просматривал</th>
            <th>Автор медиа</th>
            <th>Тип</th>
            <th>Когда</th>
          </tr>
        </thead>
        <tbody>
          {accessLog.map((entry) => (
            <tr key={entry.id}>
              <td>
                <span className={entry.action === 'SCREENSHOT_DETECTED' ? 'badge badge-danger' : 'badge'}>
                  {entry.action}
                </span>
              </td>
              <td>{entry.viewer.displayName}</td>
              <td>{entry.media.uploader.displayName}</td>
              <td>{entry.media.kind}</td>
              <td>{new Date(entry.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
