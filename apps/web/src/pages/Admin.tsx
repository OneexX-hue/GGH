import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminTask, Player, QualityCode } from '@workspace/core';
import { formatDuration } from '@workspace/core';
import { useGameClock, useGameState } from '@workspace/api-client';
import { ADMIN_TOKEN_KEY, client } from '../lib/quest.ts';

interface AdminTaskRow extends AdminTask {
  qrPayload: string | null;
}
interface AdminPlayer extends Player {
  teamName: string;
}
interface Attempt {
  id: string;
  teamName: string;
  playerName: string;
  value: string;
  ok: boolean;
  reason: string | null;
  createdAt: number;
}

export function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? '');
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(() => token !== '');

  useEffect(() => {
    client.setAdminToken(token || undefined);
  }, [token]);

  // Сохранённый токен проверяется молча: организатор во время игры перезагружает
  // вкладку и не должен каждый раз проходить вход заново.
  useEffect(() => {
    if (token === '') return;
    client.setAdminToken(token);
    client.admin
      .qualityCodes()
      .then(() => setAuthorized(true))
      .catch(() => localStorage.removeItem(ADMIN_TOKEN_KEY))
      .finally(() => setChecking(false));
    // Намеренно только при монтировании: дальше вход идёт через AdminLogin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) return <main className="p-6 text-slate-500">Проверяю доступ…</main>;
  if (!authorized) {
    return <AdminLogin token={token} setToken={setToken} onSuccess={() => setAuthorized(true)} />;
  }
  return <AdminPanel />;
}

function AdminLogin({
  token,
  setToken,
  onSuccess,
}: {
  token: string;
  setToken: (value: string) => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function check() {
    client.setAdminToken(token);
    try {
      await client.admin.qualityCodes();
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      onSuccess();
    } catch {
      setError('Токен не подошёл');
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Панель организатора</h1>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void check()}
        placeholder="Админский токен"
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={() => void check()} className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-900">
        Войти
      </button>
    </main>
  );
}

function AdminPanel() {
  const { data: state } = useGameState();
  const clock = useGameClock(state);
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);

  const command = useMutation({
    mutationFn: (action: string) => client.admin.command(action),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const status = state?.event.status ?? 'draft';

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{state?.event.name ?? 'Квест'}</h1>
          <p className="text-sm text-slate-400">
            {statusLabel(status)}
            {/* У завершённой игры «осталось» бессмысленно — показываем, сколько она шла. */}
            {status === 'finished'
              ? ` · игра шла ${formatDuration(clock.elapsedMs)}`
              : ` · осталось ${formatDuration(clock.remainingMs)}`}
          </p>
        </div>
        <a href={client.admin.exportCsvUrl()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold">
          Скачать CSV
        </a>
      </header>

      <section className="flex flex-wrap gap-2">
        <Action label="Старт" onClick={() => command.mutate('start')} disabled={status === 'running'} />
        <Action label="Пауза" onClick={() => command.mutate('pause')} disabled={status !== 'running'} />
        <Action label="Продолжить" onClick={() => command.mutate('resume')} disabled={status !== 'paused'} />
        <Action
          label="Стоп"
          onClick={() => command.mutate('stop')}
          disabled={status === 'draft' || status === 'finished'}
        />
        <Action label="Сброс" danger onClick={() => setResetOpen(true)} />
      </section>

      {status !== 'finished' && (
        <p className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-400">
          Игроки не видят ни своих баллов, ни мест — итоги откроются им автоматически, когда выйдет время
          или вы нажмёте «Стоп».
        </p>
      )}

      {resetOpen && (
        <ResetDialog eventName={state?.event.name ?? ''} onClose={() => setResetOpen(false)} />
      )}

      <Scoreboard />
      <TasksEditor />
      <QualityCodesPanel />
      <PlayersTable />
      <AttemptsLog />
      <Archives />
    </main>
  );
}

/**
 * Сброс стирает результаты всех команд. Кнопки с confirm() для этого мало:
 * требуем набрать название события, а снимок итогов уходит в архив до удаления.
 */
function ResetDialog({ eventName, onClose }: { eventName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () => client.admin.command('reset', { confirmation: typed }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-slate-900 p-5">
        <h3 className="text-lg font-bold text-red-300">Сброс игры</h3>
        <p className="text-sm text-slate-300">
          Будут удалены все сданные задания, оценки качества и журнал попыток. Задания и команды останутся.
          Снимок текущих итогов сохранится в архиве.
        </p>
        <p className="text-sm text-slate-400">
          Чтобы подтвердить, введите название события: <b className="text-slate-200">{eventName}</b>
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-red-400"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => reset.mutate()}
            disabled={typed !== eventName || reset.isPending}
            className="flex-1 rounded-lg bg-red-800 py-2.5 font-bold text-red-100 disabled:opacity-30"
          >
            Сбросить
          </button>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-5 py-2.5 font-semibold">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

function Scoreboard() {
  // Организатору нужен свой маршрут: публичное табло молчит, пока идёт игра.
  const { data } = useQuery({
    queryKey: ['admin-scoreboard'],
    queryFn: () => client.admin.scoreboard(),
    refetchInterval: 15_000,
  });
  if (!data) return null;

  return (
    <Panel title="Табло">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1">#</th>
            <th>Команда</th>
            <th className="text-right">Заданий</th>
            <th className="text-right">Качество</th>
            <th className="text-right">Итого</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={row.teamId} className="border-t border-slate-800">
              <td className="py-1.5 text-slate-500">{index + 1}</td>
              <td className="font-medium">{row.teamName}</td>
              <td className="text-right">{row.solvedCount}</td>
              <td className="text-right text-slate-400">{row.qualityPoints}</td>
              <td className="text-right font-bold text-cyan-400">{row.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.rows.length === 0 && <p className="text-slate-500">Команд пока нет.</p>}
    </Panel>
  );
}

function TasksEditor() {
  const queryClient = useQueryClient();
  const { data: tasks } = useQuery({ queryKey: ['admin-tasks'], queryFn: () => client.admin.tasks<AdminTaskRow[]>() });
  const [editing, setEditing] = useState<AdminTaskRow | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => client.admin.deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tasks'] }),
  });

  return (
    <Panel title={`Задания (${tasks?.length ?? 0})`}>
      <ul className="space-y-1">
        {tasks?.map((task) => (
          <li key={task.id} className="flex items-center gap-2 border-t border-slate-800 py-2 text-sm">
            <span className="w-6 text-slate-600">{task.orderIndex + 1}</span>
            <span className="flex-1 font-medium">{task.title}</span>
            <code className="rounded bg-slate-800 px-2 py-0.5 text-xs text-cyan-300">{task.code ?? '—'}</code>
            {task.lat !== null && <span title={`${task.lat}, ${task.lng} · ${task.radiusM} м`}>📍</span>}
            {task.qualityEnabled && <span title="Оценка качества включена">⭐</span>}
            <span className="w-8 text-right text-slate-400">{task.points}</span>
            <button onClick={() => setEditing(task)} className="text-slate-400 hover:text-cyan-400">
              ✎
            </button>
            <button
              onClick={() => confirm(`Удалить «${task.title}»?`) && remove.mutate(task.id)}
              className="text-slate-400 hover:text-red-400"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setEditing({ id: '', eventId: '', orderIndex: tasks?.length ?? 0 } as AdminTaskRow)}
        className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold"
      >
        + Новое задание
      </button>

      {editing && <TaskDialog task={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function TaskDialog({ task, onClose }: { task: AdminTaskRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: task.title ?? '',
    description: task.description ?? '',
    code: task.code ?? '',
    points: task.points ?? 10,
    lat: task.lat?.toString() ?? '',
    lng: task.lng?.toString() ?? '',
    radiusM: task.radiusM?.toString() ?? '',
    qualityEnabled: task.qualityEnabled ?? false,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        description: form.description,
        code: form.code.trim() === '' ? null : form.code,
        points: Number(form.points),
        verification: 'code' as const,
        // Гео включается только когда заданы все три поля: без радиуса точка бессмысленна.
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
        radiusM: form.radiusM === '' ? null : Number(form.radiusM),
        qualityEnabled: form.qualityEnabled,
      };
      return task.id === '' ? client.admin.createTask(body) : client.admin.updateTask(task.id, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tasks'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-lg space-y-3 rounded-2xl bg-slate-900 p-5">
        <h3 className="text-lg font-bold">{task.id === '' ? 'Новое задание' : 'Редактирование'}</h3>

        <Input label="Название" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Input label="Описание" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Код" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
          <Input label="Баллы" value={String(form.points)} onChange={(v) => setForm({ ...form, points: Number(v) || 0 })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Широта" value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
          <Input label="Долгота" value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
          <Input label="Радиус, м" value={form.radiusM} onChange={(v) => setForm({ ...form, radiusM: v })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.qualityEnabled}
            onChange={(e) => setForm({ ...form, qualityEnabled: e.target.checked })}
          />
          Оценка качества за это задание
        </label>

        {task.qrPayload && (
          <p className="break-all rounded-lg bg-slate-950 p-2 text-xs text-slate-500">QR: {task.qrPayload}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={() => save.mutate()} className="flex-1 rounded-lg bg-cyan-500 py-2.5 font-bold text-slate-900">
            Сохранить
          </button>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-5 py-2.5 font-semibold">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

function QualityCodesPanel() {
  const { data } = useQuery({ queryKey: ['admin-quality'], queryFn: () => client.admin.qualityCodes() });
  return (
    <Panel title="Коды качества">
      <p className="mb-2 text-sm text-slate-500">Эти коды судья называет команде на точке. Постоянны всю игру.</p>
      <div className="flex flex-wrap gap-2">
        {data?.map((qc: QualityCode) => (
          <span key={qc.id} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
            <code className="font-bold text-cyan-300">{qc.code}</code> — {qc.label}, {qc.points}
          </span>
        ))}
      </div>
      {(data?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-500">Появятся, когда включите оценку качества хотя бы в одном задании.</p>
      )}
    </Panel>
  );
}

function PlayersTable() {
  const { data } = useQuery({ queryKey: ['admin-players'], queryFn: () => client.admin.players<AdminPlayer[]>() });
  const now = Date.now();

  return (
    <Panel title={`Игроки (${data?.length ?? 0})`}>
      <ul className="space-y-1 text-sm">
        {data?.map((player) => {
          const online = player.lastSeenAt !== null && now - player.lastSeenAt < 120_000;
          return (
            <li key={player.id} className="flex items-center gap-2 border-t border-slate-800 py-1.5">
              <span className={online ? 'text-emerald-400' : 'text-slate-700'}>●</span>
              <span className="flex-1">{player.name}</span>
              <span className="text-slate-400">{player.teamName}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function AttemptsLog() {
  const { data } = useQuery({
    queryKey: ['admin-attempts'],
    queryFn: () => client.admin.attempts<Attempt[]>(),
    refetchInterval: 20_000,
  });

  return (
    <Panel title="Журнал попыток">
      <p className="mb-2 text-sm text-slate-500">
        Серия отказов подряд у одной команды — вероятный перебор кодов.
      </p>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto font-mono text-xs">
        {data?.map((attempt) => (
          <li key={attempt.id} className={attempt.ok ? 'text-emerald-400' : 'text-slate-500'}>
            {new Date(attempt.createdAt).toLocaleTimeString('ru')} · {attempt.teamName} · {attempt.value}
            {attempt.reason && ` · ${attempt.reason}`}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Архив прошедших игр. Снимок пишется при завершении и перед сбросом, поэтому
 * итоги квеста нельзя потерять, даже нажав «Сброс» на завершённой игре.
 */
function Archives() {
  const { data } = useQuery({ queryKey: ['admin-archives'], queryFn: () => client.admin.archives() });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Panel title={`Архив игр (${data?.length ?? 0})`}>
      {(data?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-500">Пока пусто. Снимок появится после первой завершённой игры.</p>
      )}
      <ul className="space-y-1">
        {data?.map((archive) => (
          <li key={archive.id} className="border-t border-slate-800 py-2">
            <button
              onClick={() => setOpenId(openId === archive.id ? null : archive.id)}
              className="flex w-full items-center gap-3 text-left text-sm"
            >
              <span className="flex-1 font-medium">{archive.eventName}</span>
              <span className="text-slate-500">
                {new Date(archive.finishedAt).toLocaleString('ru')}
              </span>
              <span className="text-slate-400">{archive.teamCount} команд</span>
              <span className={archive.reason === 'reset' ? 'text-amber-500' : 'text-emerald-500'}>
                {archive.reason === 'reset' ? 'перед сбросом' : 'финал'}
              </span>
            </button>

            {openId === archive.id && (
              <ol className="mt-2 space-y-0.5 pl-2 text-sm">
                {archive.rows.map((row, index) => (
                  <li key={row.teamId} className="flex gap-3">
                    <span className="w-5 text-slate-600">{index + 1}</span>
                    <span className="flex-1">{row.teamName}</span>
                    <span className="text-slate-500">{row.solvedCount} зад.</span>
                    <span className="w-12 text-right font-bold text-cyan-400">{row.totalPoints}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------- примитивы */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Action({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-5 py-2.5 font-semibold disabled:opacity-30 ${danger ? 'bg-red-900 text-red-200' : 'bg-slate-800'}`}
    >
      {label}
    </button>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
      />
    </label>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Не начата',
    running: 'Идёт',
    paused: 'На паузе',
    finished: 'Завершена',
  };
  return labels[status] ?? status;
}
