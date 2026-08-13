'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useChat } from '../../lib/chat-context';
import { useCalls } from '../../lib/calls/calls-context';
import { apiFetch } from '../../lib/api';
import { ChatAvatar } from '../../components/chat-avatar';
import {
  BellIcon,
  BellOffIcon,
  FolderIcon,
  LockIcon,
  LockSolidIcon,
  MoreIcon,
  PaperclipIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  ShieldLockIcon,
  StarIcon,
  TimerIcon,
  VideoIcon,
  XIcon,
} from '../../components/icons';
import type { RCMessage, RCSubscription, RoomType } from '../../lib/rocketchat/types';

const POLL_INTERVAL_MS = 4000;
// Тот же формат, что и mobile/src/media/marker.ts — веб-чат медиа не
// отправляет и не рендерит, но по этому префиксу может опознать, что
// сообщение из истории было медиа-вложением (см. ROADMAP.md).
const MEDIA_MARKER_PREFIX = '##CARCLUB_MEDIA##';
const MUTED_ROOMS_KEY = 'carclub-muted-rooms';

interface DirectoryMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  rocketChatUsername: string;
}

type Filter = 'all' | 'unread' | 'fav';

function loadMutedRooms(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(MUTED_ROOMS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const { ready, error: chatError, restClient, session } = useChat();
  const calls = useCalls();

  const [rooms, setRooms] = useState<RCSubscription[]>([]);
  const [selected, setSelected] = useState<
    { roomId: string; roomType: RoomType; title: string; isGroup: boolean; peerUserId?: string | null } | null
  >(null);
  const [resolvingPeer, setResolvingPeer] = useState(false);
  const [messages, setMessages] = useState<RCMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mutedRooms, setMutedRooms] = useState<Set<string>>(() => loadMutedRooms());
  const [infoOpen, setInfoOpen] = useState(true);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [creatingChatWith, setCreatingChatWith] = useState<string | null>(null);
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
    setChatSearchOpen(false);
    setChatSearchQuery('');
    if (pollRef.current) clearInterval(pollRef.current);
    if (selected) {
      pollRef.current = setInterval(loadMessages, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.roomId]);

  // Звонки в backend/src/calls адресуются реальному userId участника, не
  // Rocket.Chat id/псевдониму (см. docs/DECISIONS.md, "WebRTC-звонки —
  // архитектура") — для уже существующих (не только что созданных через
  // "Новый чат") личных чатов реальный userId неизвестен заранее, поэтому
  // резолвим его по RC-имени пользователя из первого чужого сообщения в
  // истории через /users/directory.
  useEffect(() => {
    if (!selected || selected.roomType !== 'd' || selected.peerUserId !== undefined) return;
    const theirMessage = messages.find((m) => session && m.u._id !== session.rocketChatUserId);
    if (!theirMessage) return;
    setResolvingPeer(true);
    calls
      .resolvePeerUserIdByRcUsername(theirMessage.u.username)
      .then((peerUserId) => {
        setSelected((prev) => (prev && prev.roomId === selected.roomId ? { ...prev, peerUserId } : prev));
      })
      .finally(() => setResolvingPeer(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, messages, session]);

  function toggleMute(roomId: string) {
    setMutedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      window.localStorage.setItem(MUTED_ROOMS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function toggleFavorite(room: RCSubscription) {
    if (!restClient) return;
    const next = !room.f;
    restClient.toggleFavorite(room.rid, next).catch(() => {});
    setRooms((prev) => prev.map((r) => (r._id === room._id ? { ...r, f: next } : r)));
  }

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

  function openNewChat() {
    setNewChatOpen(true);
    if (directory.length === 0 && token) {
      apiFetch<DirectoryMember[]>('/users/directory', { token })
        .then(setDirectory)
        .catch(() => setError('Не удалось загрузить справочник участников'));
    }
  }

  async function startDirectMessage(member: DirectoryMember) {
    if (!restClient) return;
    setCreatingChatWith(member.id);
    try {
      const room = await restClient.createDirectMessage(member.rocketChatUsername);
      setNewChatOpen(false);
      setSelected({ roomId: room._id, roomType: room.t, title: member.displayName, isGroup: false, peerUserId: member.id });
      loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать чат');
    } finally {
      setCreatingChatWith(null);
    }
  }

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      const name = (r.fname ?? r.name ?? '').toLowerCase();
      const matchesFilter = filter === 'all' || (filter === 'unread' && r.unread > 0) || (filter === 'fav' && !!r.f);
      const matchesQuery = !q || name.includes(q) || (r.lastMessage?.msg ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [rooms, search, filter]);

  const visibleMessages = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.msg.toLowerCase().includes(q));
  }, [messages, chatSearchQuery]);

  const mediaCountInLoadedHistory = useMemo(
    () => messages.filter((m) => m.msg.startsWith(MEDIA_MARKER_PREFIX)).length,
    [messages],
  );

  if (chatError) {
    return <p className="error">⚠️ {chatError}</p>;
  }

  const selectedRoom = rooms.find((r) => r.rid === selected?.roomId);
  const selectedMuted = selected ? mutedRooms.has(selected.roomId) : false;

  let callDisabledReason: string | null = null;
  if (!selected || selected.roomType !== 'd') callDisabledReason = 'Звонки доступны только в личных чатах';
  else if (!calls.ready) callDisabledReason = 'Подключаемся к сигнальному серверу…';
  else if (calls.status !== 'idle') callDisabledReason = 'Уже есть активный звонок';
  else if (resolvingPeer) callDisabledReason = 'Определяем собеседника…';
  else if (!selected.peerUserId) callDisabledReason = 'Не удалось определить собеседника для звонка';
  const canCall = !callDisabledReason;

  return (
    <div>
      <h1 className="page-title">💬 Чат</h1>
      <p className="page-subtitle">
        Веб-версия чата участника (ТЗ 5.2) — та же учётная запись, что и в мобильном приложении. Обновление
        сообщений — раз в {POLL_INTERVAL_MS / 1000}с, не мгновенный realtime. Отправка фото/видео и таймер
        самоуничтожения — пока только в мобильном приложении.
      </p>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="chat-window">
        <aside className="chat-sidebar">
          {newChatOpen ? (
            <div className="chat-list" style={{ flex: 1 }}>
              <div className="chat-info-head" style={{ padding: '4px 2px 10px' }}>
                <span>Новый чат</span>
                <button className="chat-ghost-btn" type="button" onClick={() => setNewChatOpen(false)} aria-label="Закрыть">
                  <XIcon size={16} />
                </button>
              </div>
              {directory.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="chat-row"
                  disabled={creatingChatWith === m.id}
                  onClick={() => startDirectMessage(m)}
                >
                  <ChatAvatar id={m.id} size={38} className="chat-row-avatar" />
                  <span className="chat-row-body">
                    <span className="chat-row-name">{m.displayName}</span>
                  </span>
                  {creatingChatWith === m.id && <span className="chat-row-time">…</span>}
                </button>
              ))}
              {directory.length === 0 && (
                <p className="text-muted-foreground" style={{ padding: 12 }}>
                  Загрузка справочника участников…
                </p>
              )}
            </div>
          ) : (
            <>
              <button className="chat-new" type="button" onClick={openNewChat}>
                <PlusIcon size={16} /> Новый чат
              </button>

              <label className="chat-field">
                <SearchIcon size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по чатам"
                  aria-label="Поиск по чатам"
                />
              </label>

              <nav className="chat-tabs">
                {(['all', 'unread', 'fav'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chat-tab${filter === f ? ' is-active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'Все' : f === 'unread' ? 'Непрочитанные' : 'Избранные'}
                  </button>
                ))}
              </nav>

              <div className="chat-list">
                {filteredRooms.map((r) => {
                  const name = r.fname ?? r.name ?? 'Чат';
                  const isGroup = r.t !== 'd';
                  const muted = mutedRooms.has(r.rid);
                  return (
                    <button
                      key={r._id}
                      type="button"
                      className={`chat-row${selected?.roomId === r.rid ? ' is-active' : ''}`}
                      onClick={() =>
                        setSelected({
                          roomId: r.rid,
                          roomType: r.t,
                          title: name,
                          isGroup,
                          peerUserId: r.t === 'd' ? undefined : null,
                        })
                      }
                    >
                      <ChatAvatar id={r.rid} isGroup={isGroup} size={38} className="chat-row-avatar" />
                      <span className="chat-row-body">
                        <span className="chat-row-top">
                          <span className="chat-row-name">
                            {name} <LockSolidIcon size={12} />
                          </span>
                          <span className="chat-row-time">{formatTime(r._updatedAt)}</span>
                        </span>
                        <span className="chat-row-bottom">
                          <span className="chat-row-text">{r.lastMessage?.msg ?? ''}</span>
                          {muted ? (
                            <BellOffIcon size={14} />
                          ) : (
                            r.unread > 0 && <span className="badge badge-primary">{r.unread}</span>
                          )}
                          <span
                            role="button"
                            tabIndex={0}
                            title={r.f ? 'Убрать из избранного' : 'Добавить в избранное'}
                            aria-label={r.f ? 'Убрать из избранного' : 'Добавить в избранное'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(r);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                e.preventDefault();
                                toggleFavorite(r);
                              }
                            }}
                            style={{ color: r.f ? 'var(--primary)' : 'var(--text-4)', display: 'inline-flex' }}
                          >
                            <StarIcon size={14} />
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
                {filteredRooms.length === 0 && (
                  <p className="text-muted-foreground" style={{ padding: 12 }}>
                    {rooms.length === 0 ? 'Пока нет чатов' : 'Ничего не найдено'}
                  </p>
                )}
              </div>

              <footer className="chat-secrecy">
                <span className="chat-secrecy-icon">
                  <ShieldLockIcon size={16} />
                </span>
                <span className="chat-secrecy-body">
                  <small>Шифрование при хранении + защищённый транспорт</small>
                </span>
              </footer>
            </>
          )}
        </aside>

        <section className="chat-conversation">
          {!selected ? (
            <p className="text-muted-foreground" style={{ padding: 20 }}>
              Выберите чат слева
            </p>
          ) : (
            <>
              <header className="chat-head">
                <span className="chat-head-identity">
                  <ChatAvatar id={selected.roomId} isGroup={selected.isGroup} size={38} />
                  <span className="chat-head-who">
                    <strong>
                      {selected.title} <LockSolidIcon size={13} />
                    </strong>
                    <small>{selectedRoom?.f ? 'В избранном' : ' '}</small>
                  </span>
                </span>
                <span className="chat-head-actions">
                  <button
                    className="chat-ghost-btn"
                    type="button"
                    title="Поиск в чате"
                    aria-label="Поиск в чате"
                    onClick={() => setChatSearchOpen((v) => !v)}
                  >
                    <SearchIcon size={17} />
                  </button>
                  <button
                    className="chat-ghost-btn"
                    type="button"
                    disabled={!canCall}
                    title={callDisabledReason ?? 'Аудиозвонок'}
                    aria-label="Аудиозвонок"
                    onClick={() => selected.peerUserId && calls.startCall(selected.peerUserId, selected.title, 'audio')}
                  >
                    <PhoneIcon size={17} />
                  </button>
                  <button
                    className="chat-ghost-btn"
                    type="button"
                    disabled={!canCall}
                    title={callDisabledReason ?? 'Видеозвонок'}
                    aria-label="Видеозвонок"
                    onClick={() => selected.peerUserId && calls.startCall(selected.peerUserId, selected.title, 'video')}
                  >
                    <VideoIcon size={17} />
                  </button>
                  <button
                    className="chat-ghost-btn"
                    type="button"
                    title="Информация о чате"
                    aria-label="Информация о чате"
                    onClick={() => setInfoOpen((v) => !v)}
                  >
                    <MoreIcon size={17} />
                  </button>
                </span>
              </header>

              {chatSearchOpen && (
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                  <input
                    autoFocus
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Поиск по загруженным сообщениям…"
                    style={{
                      width: '100%',
                      background: 'var(--input)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
              )}

              <div className="chat-canvas">
                <div className="chat-canvas-inner">
                  {visibleMessages.map((m) => {
                    const isMe = session ? m.u._id === session.rocketChatUserId : false;
                    return (
                      <div key={m._id} className={`chat-msg ${isMe ? 'is-out' : 'is-in'}`}>
                        <div className="chat-bubble">
                          {selected.isGroup && !isMe && (
                            <span className="chat-bubble-author">{m.u.name ?? m.u.username}</span>
                          )}
                          <span className="chat-bubble-text">{m.msg}</span>
                          <span className="chat-bubble-meta">
                            {formatTime(m.ts)} <LockSolidIcon size={12} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {visibleMessages.length === 0 && (
                    <p className="text-muted-foreground" style={{ alignSelf: 'center' }}>
                      {chatSearchQuery ? 'Ничего не найдено' : 'Сообщений пока нет'}
                    </p>
                  )}
                </div>
              </div>

              <div className="chat-composer">
                <button className="chat-round-btn" type="button" disabled title="Отправка файлов — пока только в мобильном приложении">
                  <PaperclipIcon size={18} />
                </button>
                <span className="chat-composer-field">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSend()}
                    placeholder="Напишите сообщение…"
                    aria-label="Сообщение"
                  />
                  <button
                    className="chat-ghost-btn"
                    type="button"
                    disabled
                    title="Исчезающие сообщения — пока только в мобильном приложении"
                  >
                    <TimerIcon size={18} />
                  </button>
                </span>
                <button className="chat-round-btn" type="button" onClick={onSend} disabled={!draft.trim()} aria-label="Отправить">
                  <SendIcon size={17} />
                </button>
              </div>
            </>
          )}
        </section>

        {selected && infoOpen && (
          <aside className="chat-info">
            <header className="chat-info-head">
              <span>Информация о чате</span>
              <button className="chat-ghost-btn" type="button" onClick={() => setInfoOpen(false)} aria-label="Закрыть панель">
                <XIcon size={16} />
              </button>
            </header>

            <div className="chat-info-profile">
              <ChatAvatar id={selected.roomId} isGroup={selected.isGroup} size={96} className="chat-portrait" />
              <h2>
                {selected.title} <LockSolidIcon size={14} />
              </h2>
              <p>{selectedRoom?.f ? 'В избранном' : selected.isGroup ? 'Групповой чат' : 'Личный чат'}</p>
            </div>

            <div className="chat-info-list">
              <div className="chat-opt">
                {selectedMuted ? <BellOffIcon size={18} className="chat-opt-icon" /> : <BellIcon size={18} className="chat-opt-icon" />}
                <span className="chat-opt-label">Уведомления</span>
                <label className="chat-switch">
                  <input type="checkbox" checked={!selectedMuted} onChange={() => toggleMute(selected.roomId)} aria-label="Уведомления" />
                  <i />
                </label>
              </div>

              <div className="chat-opt">
                <TimerIcon size={18} className="chat-opt-icon" />
                <span className="chat-opt-label">
                  Исчезающие сообщения
                  <small>Недоступно в веб-версии — есть в мобильном приложении</small>
                </span>
              </div>

              <div className="chat-opt">
                <LockIcon size={18} className="chat-opt-icon" />
                <span className="chat-opt-label">
                  Шифрование
                  <small>Данные шифруются на сервере (AES-256), передача — по защищённому HTTPS/WSS-транспорту</small>
                </span>
              </div>

              <div className="chat-opt">
                <FolderIcon size={18} className="chat-opt-icon" />
                <span className="chat-opt-label">
                  Файлы и медиа
                  <small>Подсчитано по загруженной истории чата, не по всей переписке</small>
                </span>
                <span className="chat-opt-value">{mediaCountInLoadedHistory}</span>
              </div>
            </div>
          </aside>
        )}
      </div>

      <section className="chat-features" aria-label="Что реально защищает эту переписку">
        <article className="chat-feature">
          <span className="chat-feature-icon">
            <LockIcon size={22} />
          </span>
          <div>
            <h3>Шифрование при хранении</h3>
            <p>Медиа шифруется AES-256 на сервере. Транспорт — HTTPS/WSS. Не сквозное (E2E) шифрование.</p>
          </div>
        </article>
        <article className="chat-feature">
          <span className="chat-feature-icon">
            <TimerIcon size={22} />
          </span>
          <div>
            <h3>Самоуничтожение сообщений</h3>
            <p>Реальная функция в мобильном приложении — таймер удаляет сообщение после истечения срока.</p>
          </div>
        </article>
        <article className="chat-feature">
          <span className="chat-feature-icon">
            <ShieldLockIcon size={22} />
          </span>
          <div>
            <h3>Псевдонимная личность</h3>
            <p>В чате виден только псевдоним участника, не реальное имя — даже для модератора.</p>
          </div>
        </article>
        <article className="chat-feature">
          <span className="chat-feature-icon">
            <FolderIcon size={22} />
          </span>
          <div>
            <h3>Защита медиа</h3>
            <p>Фото/видео выдаются по короткоживущему токену с водяным знаком, журналом доступа и детектом скриншота.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
