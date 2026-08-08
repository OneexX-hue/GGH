import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import type { Coords, SubmitCodeResponse } from '@workspace/core';
import { formatDuration } from '@workspace/core';
import {
  useClaimQuality,
  useGameClock,
  useGameState,
  useLiveUpdates,
  useQualityCodes,
  useQueueFlush,
  useSubmitCode,
  useTasks,
  type PlayerTask,
} from '@workspace/api-client';
import { theme } from '../src/theme.ts';

export default function Game() {
  useLiveUpdates();
  const { data: state } = useGameState();
  const { data: tasksData, isLoading } = useTasks();
  const clock = useGameClock(state);
  const pendingOffline = useQueueFlush();

  // Код, принесённый экраном сканирования, подставляется в открытое задание.
  const params = useLocalSearchParams<{ scannedCode?: string; taskId?: string }>();
  const [openTaskId, setOpenTaskId] = useState<string | null>(params.taskId ?? null);

  const tasks = tasksData?.tasks ?? [];
  const solved = tasks.filter((t) => t.solved).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Timer remainingMs={clock.remainingMs} isRunning={clock.isRunning} status={state?.event.status} />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <Text style={{ color: theme.textDim }}>
          Задания {solved} / {tasks.length}
        </Text>
        <Text style={{ color: theme.accent, fontSize: 20, fontWeight: '900' }}>
          {tasksData?.totalPoints ?? 0} очков
        </Text>
      </View>

      {pendingOffline > 0 && (
        <Text style={{ backgroundColor: '#451a03', color: theme.warning, borderRadius: 12, padding: 12 }}>
          Нет связи. {pendingOffline} {plural(pendingOffline, 'код', 'кода', 'кодов')} отправятся автоматически — баллы
          не потеряются.
        </Text>
      )}

      {isLoading && <ActivityIndicator color={theme.accent} />}

      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          open={openTaskId === task.id}
          canSubmit={clock.isRunning}
          initialCode={openTaskId === task.id ? params.scannedCode : undefined}
          onToggle={() => setOpenTaskId(openTaskId === task.id ? null : task.id)}
        />
      ))}
    </ScrollView>
  );
}

function Timer({ remainingMs, isRunning, status }: { remainingMs: number; isRunning: boolean; status?: string }) {
  const urgent = isRunning && remainingMs < 10 * 60 * 1000;

  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text
        style={{
          color: urgent ? theme.danger : theme.text,
          fontSize: 52,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatDuration(remainingMs)}
      </Text>
      <Text style={{ color: theme.textDim, fontSize: 13 }}>
        {status === 'paused' ? '⏸ Пауза — коды не принимаются' : null}
        {status === 'draft' ? 'Игра ещё не началась' : null}
        {status === 'finished' ? 'Время вышло' : null}
        {status === 'running' ? 'Игра идёт' : null}
      </Text>
    </View>
  );
}

interface TaskCardProps {
  task: PlayerTask;
  open: boolean;
  canSubmit: boolean;
  initialCode?: string;
  onToggle: () => void;
}

function TaskCard({ task, open, canSubmit, initialCode, onToggle }: TaskCardProps) {
  return (
    <View
      style={{
        backgroundColor: task.solved ? '#052e2b' : theme.surface,
        borderColor: task.solved ? theme.success : theme.border,
        borderWidth: 1,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
      >
        <Text style={{ color: task.solved ? theme.success : theme.textFaint, fontSize: 18 }}>
          {task.solved ? '✓' : '○'}
        </Text>
        <Text style={{ color: theme.text, flex: 1, fontWeight: '700', fontSize: 16 }}>{task.title}</Text>
        {task.lat !== null && <Text>📍</Text>}
        <Text style={{ color: theme.textFaint }}>{task.points}</Text>
      </Pressable>

      {open && (
        <View style={{ borderTopColor: theme.border, borderTopWidth: 1, padding: 14, gap: 12 }}>
          {task.description !== '' && <Text style={{ color: theme.textDim, lineHeight: 20 }}>{task.description}</Text>}
          {!task.solved && canSubmit && <CodeForm task={task} initialCode={initialCode} />}
          {!task.solved && !canSubmit && (
            <Text style={{ color: theme.textFaint }}>Коды принимаются только во время игры.</Text>
          )}
          {task.solved && task.qualityEnabled && !task.qualityClaimed && <QualityForm taskId={task.id} />}
          {task.qualityClaimed && <Text style={{ color: theme.success }}>Оценка качества выставлена</Text>}
        </View>
      )}
    </View>
  );
}

function CodeForm({ task, initialCode }: { task: PlayerTask; initialCode?: string }) {
  const submit = useSubmitCode();
  const [code, setCode] = useState(initialCode ?? '');
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
        idempotencyKey: globalThis.crypto.randomUUID(),
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
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Код с точки"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{
            flex: 1,
            backgroundColor: theme.surfaceAlt,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 12,
            color: theme.text,
            fontSize: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        />
        <Pressable
          onPress={() => void onSubmit()}
          disabled={submit.isPending || code.trim() === ''}
          style={{
            backgroundColor: theme.accent,
            opacity: submit.isPending || code.trim() === '' ? 0.4 : 1,
            borderRadius: 12,
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <Text style={{ color: theme.accentText, fontWeight: '800' }}>Сдать</Text>
        </Pressable>
      </View>

      {/* Ввод восьми символов на бегу — главный источник раздражения. QR быстрее. */}
      <Pressable
        onPress={() => router.push({ pathname: '/scan', params: { taskId: task.id } })}
        style={{ backgroundColor: theme.surfaceAlt, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={{ color: theme.accent, fontWeight: '700' }}>Сканировать QR</Text>
      </Pressable>

      {feedback !== null && <Text style={{ color: theme.textDim }}>{feedback}</Text>}
    </View>
  );
}

function QualityForm({ taskId }: { taskId: string }) {
  const { data: codes } = useQualityCodes();
  const claim = useClaimQuality();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onSubmit() {
    try {
      const result = await claim.mutateAsync({ code, taskId, idempotencyKey: globalThis.crypto.randomUUID() });
      setFeedback(describe(result));
      setCode('');
    } catch {
      setFeedback('Не удалось отправить код качества.');
    }
  }

  return (
    <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 12, gap: 8 }}>
      <Text style={{ color: theme.textDim, fontWeight: '600' }}>Код качества от судьи</Text>
      <Text style={{ color: theme.textFaint, fontSize: 12 }}>
        {codes?.map((c) => `${c.label} — ${c.points}`).join(' · ') ?? 'Загружаю…'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{
            flex: 1,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 10,
            color: theme.text,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        <Pressable
          onPress={() => void onSubmit()}
          disabled={claim.isPending || code.trim() === ''}
          style={{
            backgroundColor: theme.border,
            opacity: claim.isPending || code.trim() === '' ? 0.4 : 1,
            borderRadius: 10,
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: theme.text, fontWeight: '700' }}>Ок</Text>
        </Pressable>
      </View>
      {feedback !== null && <Text style={{ color: theme.textDim }}>{feedback}</Text>}
    </View>
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

/** Разрешение спрашивается в момент, когда оно действительно нужно, а не на старте. */
async function currentCoords(): Promise<Coords | undefined> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return undefined;

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: position.coords.accuracy ?? undefined,
  };
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
