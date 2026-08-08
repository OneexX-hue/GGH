import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { formatDuration } from '@workspace/core';
import { ApiError, useGameClock, useGameState } from '@workspace/api-client';
import { client, deviceId, hasToken } from '../src/lib/quest.ts';
import { theme } from '../src/theme.ts';

export default function Registration() {
  const { data: state } = useGameState();
  const clock = useGameClock(state);

  const [checking, setChecking] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Игрок уже входил с этого устройства — форму показывать не нужно.
  useEffect(() => {
    void hasToken().then((exists) => {
      if (exists) router.replace('/game');
      else setChecking(false);
    });
  }, []);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await client.register({
        playerName: playerName.trim(),
        teamName: teamName.trim(),
        deviceId: await deviceId(),
      });
      router.replace('/game');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const ready = playerName.trim() !== '' && teamName.trim() !== '' && !busy;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 24 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.text, fontSize: 30, fontWeight: '900' }}>
            {state?.event.name ?? 'Городской квест'}
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 15 }}>{statusLine(state?.event.status, clock.remainingMs)}</Text>
        </View>

        <View style={{ gap: 16 }}>
          <Field label="Ваше имя" value={playerName} onChangeText={setPlayerName} placeholder="Аня" />
          <Field label="Название команды" value={teamName} onChangeText={setTeamName} placeholder="Совы" />
          <Text style={{ color: theme.textFaint, fontSize: 12 }}>
            Если команда уже зарегистрирована, введите то же название — вы присоединитесь к ней.
          </Text>
        </View>

        {error !== null && (
          <Text style={{ color: theme.danger, backgroundColor: '#450a0a', padding: 12, borderRadius: 12 }}>{error}</Text>
        )}

        <Pressable
          onPress={() => void onSubmit()}
          disabled={!ready}
          style={{
            backgroundColor: theme.accent,
            opacity: ready ? 1 : 0.4,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.accentText, fontSize: 18, fontWeight: '800' }}>
            {busy ? 'Регистрирую…' : 'Войти в игру'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function statusLine(status: string | undefined, remainingMs: number): string {
  switch (status) {
    case 'running':
      return `Игра идёт, осталось ${formatDuration(remainingMs)}`;
    case 'paused':
      return 'Игра на паузе';
    case 'finished':
      return 'Игра завершена';
    default:
      return 'Регистрация открыта, ждём старта';
  }
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

function Field({ label, value, onChangeText, placeholder }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.textDim, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        maxLength={80}
        style={{
          backgroundColor: theme.surfaceAlt,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 14,
          color: theme.text,
          fontSize: 18,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      />
    </View>
  );
}
