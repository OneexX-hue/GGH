import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import type { Coords, SubmitCodeResponse } from '@workspace/core';
import { formatDuration } from '@workspace/core';
import {
  useClaimQuality,
  useGameClock,
  useGameState,
  useQualityCodes,
  useQueueFlush,
  useSubmitCode,
  useTasks,
  type PlayerTask,
} from '@workspace/api-client';
import { hasToken } from '../lib/quest.ts';

export function Game() {
  const [, navigate] = useLocation();
  const { data: state } = useGameState();
  const { data: tasksData, isLoading } = useTasks();
  const clock = useGameClock(state);
  const pendingOffline = useQueueFlush();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken()) navigate('/', { replace: true });
  }, [navigate]);

  const tasks = tasksData?.tasks ?? [];
  const solvedCount = tasks.filter((t) => t.solved).length;

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 pb-24">
      <Timer clock={clock} status={state?.event.status} />

      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
        <span className="text-sm text-slate-400">
          Задания {solvedCount} / {tasks.length}
        </span>
        <span className="text-xl font-black text-cyan-400">{tasksData?.totalPoints ?? 0} очков</span>
      </div>

      {pendingOffline > 0 && (
        <p className="rounded-xl bg-amber-950 px-4 py-3 text-sm text-amber-300">
          Нет связи. {pendingOffline} {plural(pendingOffline, 'код', 'кода', 'кодов')} отправятся автоматически —
          баллы не потеряются.
        </p>
      )}

      {isLoading && <p className="text-slate-500">Загружаю задания…</p>}

      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            open={openTaskId === task.id}
            canSubmit={clock.isRunning}
            onToggle={() => setOpenTaskId(openTaskId === task.id ? null : task.id)}
          />
        ))}
      </ul>
    </main>
  );
}

/* -------------------------------------------------------------- таймер */

function Timer({ clock, status }: { clock: ReturnType<typeof useGameClock>; status: string | undefined }) {
  const urgent = clock.remainingMs < 10 * 60 * 1000 && clock.isRunning;

  return (
    <div className="sticky top-0 z-10 -mx-4 bg-slate-950/95 px-4 py-3 backdrop-blur">
      <p
        className={`text-center font-mono text-5xl font-black tabular-nums ${urgent ? 'text-red-400' : 'text-slate-100'}`}
      >
        {formatDuration(clock.remainingMs)}
      </p>
      <p className="text-center text-sm text-slate-400">
        {status === 'paused' && '⏸ Пауза — коды не принимаются'}
        {status === 'draft' && 'Игра ещё не началась'}
        {(status === 'finished' || clock.isOver) && 'Время вышло'}
        {status === 'running' && !clock.isOver && 'Игра идёт'}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- карточка */

interface TaskCardProps {
  task: PlayerTask;
  open: boolean;
  canSubmit: boolean;
  onToggle: () => void;
}

function TaskCard({ task, open, canSubmit, onToggle }: TaskCardProps) {
  return (
    <li className={`overflow-hidden rounded-xl border ${task.solved ? 'border-emerald-800 bg-emerald-950/40' : 'border-slate-800 bg-slate-900'}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`text-xl ${task.solved ? 'text-emerald-400' : 'text-slate-600'}`}>
          {task.solved ? '✓' : '○'}
        </span>
        <span className="flex-1 font-semibold">{task.title}</span>
        {task.lat !== null && <span title="Требуется быть на точке">📍</span>}
        <span className="text-sm text-slate-500">{task.points}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800 px-4 py-3">
          {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
          {!task.solved && canSubmit && <CodeForm task={task} />}
          {!task.solved && !canSubmit && <p className="text-sm text-slate-500">Коды принимаются только во время игры.</p>}
          {task.solved && task.qualityEnabled && !task.qualityClaimed && <QualityForm taskId={task.id} />}
          {task.qualityClaimed && <p className="text-sm text-emerald-400">Оценка качества выставлена</p>}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------- ввод кода */

function CodeForm({ task }: { task: PlayerTask }) {
  const submit = useSubmitCode();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const needsGeo = task.lat !== null && task.lng !== null;

  async function onSubmit() {
    setFeedback(null);
    const coords = needsGeo ? await currentCoords() : undefined;
    if (needsGeo && !coords) {
      setFeedback('Задание требует геолокации — разрешите доступ к местоположению.');
      return;
    }

    try {
      const result = await submit.mutateAsync({
        taskId: task.id,
        code,
        idempotencyKey: crypto.randomUUID(),
        submittedAt: Date.now(),
        ...(coords ? { coords } : {}),
      });
      setCode('');
      setFeedback(result === 'queued' ? 'Связи нет — код сохранён и уйдёт сам.' : describe(result));
    } catch {
      setFeedback('Не удалось отправить код. Попробуйте ещё раз.');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && code.trim() !== '' && void onSubmit()}
          placeholder="Код с точки"
          // Автозамена и автозаглавные на телефоне портят ввод кода.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 uppercase outline-none focus:border-cyan-400"
        />
        <button
          onClick={() => void onSubmit()}
          disabled={submit.isPending || code.trim() === ''}
          className="rounded-lg bg-cyan-500 px-5 font-bold text-slate-900 disabled:opacity-40"
        >
          {submit.isPending ? '…' : 'Сдать'}
        </button>
      </div>
      {feedback && <p className="text-sm text-slate-300">{feedback}</p>}
    </div>
  );
}

function QualityForm({ taskId }: { taskId: string }) {
  const { data: codes } = useQualityCodes();
  const claim = useClaimQuality();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onSubmit() {
    try {
      const result = await claim.mutateAsync({ code, taskId, idempotencyKey: crypto.randomUUID() });
      setFeedback(describe(result));
      setCode('');
    } catch {
      setFeedback('Не удалось отправить код качества.');
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-950 p-3">
      <p className="text-sm font-medium text-slate-300">Код качества от судьи</p>
      <p className="text-xs text-slate-500">
        {codes?.map((c) => `${c.label} — ${c.points}`).join(' · ') ?? 'Загружаю…'}
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 uppercase outline-none focus:border-cyan-400"
        />
        <button
          onClick={() => void onSubmit()}
          disabled={claim.isPending || code.trim() === ''}
          className="rounded-lg bg-slate-700 px-4 text-sm font-semibold disabled:opacity-40"
        >
          Ок
        </button>
      </div>
      {feedback && <p className="text-sm text-slate-300">{feedback}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ помощники */

function describe(result: SubmitCodeResponse): string {
  if (result.status === 'accepted') return `Принято, +${result.pointsAwarded}`;
  switch (result.reason) {
    case 'wrong_code':
      return 'Код не подходит';
    case 'already_solved':
      return 'Это задание уже засчитано';
    case 'too_far':
      return result.distanceM === null ? 'Вы не на точке' : `Вы в ${result.distanceM} м от точки`;
    case 'game_not_running':
      return 'Игра сейчас не идёт';
    case 'rate_limited':
      return 'Слишком много попыток, подождите минуту';
    default:
      return 'Отклонено';
  }
}

/** Геолокация с таймаутом: ждать фикса дольше 10 секунд на бегу бессмысленно. */
function currentCoords(): Promise<Coords | undefined> {
  if (!('geolocation' in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 },
    );
  });
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
