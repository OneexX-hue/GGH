import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuestProvider } from '@workspace/api-client';
import { client, queue, subscribe } from '../src/lib/quest.ts';
import { theme } from '../src/theme.ts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // На квесте связь рвётся постоянно: одна повторная попытка вместо трёх
      // экономит батарею и не держит экран в состоянии загрузки.
      retry: 1,
      staleTime: 5_000,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <QuestProvider value={{ client, queue, subscribe }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.text,
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Регистрация' }} />
            <Stack.Screen name="game" options={{ title: 'Игра', headerBackVisible: false }} />
            <Stack.Screen name="scan" options={{ title: 'Сканировать QR', presentation: 'modal' }} />
          </Stack>
        </QuestProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
