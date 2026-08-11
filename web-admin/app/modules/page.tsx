'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';

interface ModuleDefinition {
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export default function ModulesPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadModules(currentToken: string) {
    apiFetch<ModuleDefinition[]>('/modules', { token: currentToken })
      .then((result) => {
        setModules(result);
        setConfigDrafts(Object.fromEntries(result.map((m) => [m.key, JSON.stringify(m.config, null, 2)])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'));
  }

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    loadModules(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, router]);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (!token || !key || !name) return;
    setError(null);
    try {
      await apiFetch('/modules', { method: 'POST', token, body: { key, name, description: description || undefined } });
      setKey('');
      setName('');
      setDescription('');
      loadModules(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрировать модуль');
    }
  }

  async function onToggleEnabled(mod: ModuleDefinition) {
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`/modules/${mod.key}`, { method: 'PATCH', token, body: { isEnabled: !mod.isEnabled } });
      loadModules(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить статус модуля');
    }
  }

  async function onSaveConfig(mod: ModuleDefinition) {
    if (!token) return;
    setError(null);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configDrafts[mod.key] ?? '{}');
    } catch {
      setError('Конфиг должен быть корректным JSON');
      return;
    }
    try {
      await apiFetch(`/modules/${mod.key}`, { method: 'PATCH', token, body: { config } });
      loadModules(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить конфиг');
    }
  }

  return (
    <div>
      <h1>Модули</h1>
      {error && <p className="error">{error}</p>}

      <form onSubmit={onRegister} className="form-row">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Ключ (например auto-quest)" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание (опц.)" />
        <button type="submit">Зарегистрировать</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Ключ</th>
            <th>Название</th>
            <th>Статус</th>
            <th>Конфиг (JSON)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {modules.map((mod) => (
            <tr key={mod.key}>
              <td>
                <code>{mod.key}</code>
              </td>
              <td>{mod.name}</td>
              <td>
                <span className="badge">{mod.isEnabled ? 'включён' : 'выключен'}</span>
              </td>
              <td>
                <textarea
                  rows={3}
                  style={{ width: 260, fontFamily: 'monospace' }}
                  value={configDrafts[mod.key] ?? '{}'}
                  onChange={(e) => setConfigDrafts((prev) => ({ ...prev, [mod.key]: e.target.value }))}
                />
              </td>
              <td>
                <button onClick={() => onToggleEnabled(mod)}>{mod.isEnabled ? 'Выключить' : 'Включить'}</button>{' '}
                <button onClick={() => onSaveConfig(mod)}>Сохранить конфиг</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
