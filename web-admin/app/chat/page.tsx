'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useChat } from '../../lib/chat-context';
import type { RCMessage, RCSubscription, RoomType } from '../../lib/rocketchat/types';

const POLL_INTERVAL_MS = 4000;

export default function ChatPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const { ready, error: chatError, restClient } = useChat();

  const [rooms, setRooms] = useState<RCSubscription[]>([]);
  const [selected, setSelected] = useState<{ roomId: string; roomType: RoomType; title: string } | null>(null);
  const [messages, setMessages] = useState<RCMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) router.replace('/login');
  }, [token, loading, router]);

  const loadRooms = useCallback(() => {
    if (!restClient) return;
    restClient
      .listSubscriptions()
      .then((subs) => {
        subs.sort((a, b) => (a._updatedAt < b._updatedAt ? 1 : -1));
        setRooms(subs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить чаты'));
  }, [restClient]);

  useEffect(() => {
    if (ready) loadRooms();
  }, [ready, loadRooms]);

  const loadMessages = useCallback(() => {
    if (!restClient || !selected) return;
    restClient
      .getHistory(selected.roomType, selected.roomId)
      .then((msgs) => setMessages([...msgs].reverse()))
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения'));
  }, [restClient, selected]);

  useEffect(() => {
    loadMessages();
    if (pollRef.current) clearInterval(pollRef.current);
    if (selected) {
      pollRef.current = setInterval(loadMessages, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selected, loadMessages]);

  async function onSend() {
    const text = draft.trim();
    if (!text || !restClient || !selected) return;
    setDraft('');
    try {
      await restClient.postMessage(selected.roomId, text);
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    }
  }

  if (chatError) {
    return <p className="error">⚠️ {chatError}</p>;
  }

  return (
    <div>
      <h1 className="page-title">💬 Чат</h1>
      <p className="page-subtitle">
        Веб-версия чата участника (ТЗ 5.2) — та же учётная запись, что и в мобильном приложении.
        Обновление сообщений — раз в {POLL_INTERVAL_MS / 1000}с, не мгновенный realtime. Только
        текст — отправка защищённых фото/видео пока доступна только в мобильном приложении.
      </p>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="chat-shell">
        <aside className="chat-shell-list">
          {rooms.map((r) => {
            const name = r.fname ?? r.name ?? 'Чат';
            return (
              <button
                key={r._id}
                className={`chat-shell-room${selected?.roomId === r.rid ? ' is-active' : ''}`}
                onClick={() => setSelected({ roomId: r.rid, roomType: r.t, title: name })}
              >
                <span className="chat-shell-room-name">{name}</span>
                {r.unread > 0 && <span className="badge badge-primary">{r.unread}</span>}
              </button>
            );
          })}
          {rooms.length === 0 && <p className="text-muted-foreground" style={{ padding: 12 }}>Пока нет чатов</p>}
        </aside>

        <section className="chat-shell-conversation">
          {!selected ? (
            <p className="text-muted-foreground" style={{ padding: 20 }}>
              Выберите чат слева
            </p>
          ) : (
            <>
              <header className="chat-shell-head">
                <strong>{selected.title}</strong>
              </header>
              <div className="chat-shell-messages">
                {messages.map((m) => (
                  <div key={m._id} className="chat-shell-message">
                    <span className="chat-shell-message-author">{m.u.name ?? m.u.username}</span>
                    <span className="chat-shell-message-text">{m.msg}</span>
                  </div>
                ))}
                {messages.length === 0 && <p className="text-muted-foreground">Сообщений пока нет</p>}
              </div>
              <div className="chat-shell-composer">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSend()}
                  placeholder="Напишите сообщение…"
                />
                <button onClick={onSend}>Отправить</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
