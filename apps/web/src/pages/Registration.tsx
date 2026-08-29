import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { formatDuration } from '@workspace/core';
import { ApiError, useGameClock, useGameState } from '@workspace/api-client';
import { client, deviceId, hasToken } from '../lib/quest.ts';

export function Registration() {
  const [, navigate] = useLocation();
  const { data: state } = useGameState();
  const clock = useGameClock(state);

  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Игрок, уже зарегистрированный на этом устройстве, не должен видеть форму заново.
  useEffect(() => {
    if (hasToken()) navigate('/game', { replace: true });
  }, [navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await client.register({ playerName: playerName.trim(), teamName: teamName.trim(), deviceId: deviceId() });
      navigate('/game', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться');
    } finally {
      setBusy(false);
    }
  }

  const status = state?.event.status;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{state?.event.name ?? 'Городской квест'}</h1>
        <p className="text-slate-400">
          {status === 'running' && `Игра идёт, осталось ${formatDuration(clock.remainingMs)}`}
          {status === 'paused' && 'Игра на паузе'}
          {status === 'finished' && 'Игра завершена'}
          {(status === 'draft' || status === undefined) && 'Регистрация открыта, ждём старта'}
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Ваше имя" value={playerName} onChange={setPlayerName} placeholder="Аня" autoFocus />
        <Field label="Название команды" value={teamName} onChange={setTeamName} placeholder="Совы" />

        <p className="text-xs text-slate-500">
          Если команда уже зарегистрирована, введите то же название — вы присоединитесь к ней.
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || playerName.trim() === '' || teamName.trim() === ''}
          className="w-full rounded-xl bg-cyan-500 px-5 py-4 text-lg font-bold text-slate-900 transition disabled:opacity-40"
        >
          {busy ? 'Регистрирую…' : 'Войти в игру'}
        </button>
      </form>
    </main>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function Field({ label, value, onChange, placeholder, autoFocus }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={80}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-cyan-400"
      />
    </label>
  );
}
