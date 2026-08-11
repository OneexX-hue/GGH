'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, ApiError } from '../../lib/api';
import { PlusIcon } from '../../components/icons';

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
      <h1 className="page-title">🧩 Модули</h1>
      <p className="page-subtitle">Реестр игровых модулей — включение/выключение сразу блокирует их эндпоинты</p>
      {error && <p className="error">⚠️ {error}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={onRegister} className="form-row" style={{ marginBottom: 0 }}>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Ключ (например auto-quest)" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание (опц.)" />
          <button type="submit">
            <PlusIcon size={14} /> Зарегистрировать
          </button>
        </form>
      </div>

      <div className="card">
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
                  <span className={mod.isEnabled ? 'badge badge-success' : 'badge'}>
                    {mod.isEnabled ? '🟢 включён' : '⚪ выключен'}
                  </span>
                </td>
                <td>
                  <textarea
                    rows={3}
                    className="font-mono"
                    style={{ width: 260 }}
                    value={configDrafts[mod.key] ?? '{}'}
                    onChange={(e) => setConfigDrafts((prev) => ({ ...prev, [mod.key]: e.target.value }))}
                  />
                </td>
                <td>
                  <span className="inline-flex flex-col gap-2">
                    <button className={mod.isEnabled ? 'btn-outline' : undefined} onClick={() => onToggleEnabled(mod)}>
                      {mod.isEnabled ? '⏸️ Выключить' : '▶️ Включить'}
                    </button>
                    <button className="btn-outline" onClick={() => onSaveConfig(mod)}>
                      💾 Сохранить конфиг
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
