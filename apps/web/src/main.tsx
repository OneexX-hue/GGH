import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuestProvider } from '@workspace/api-client';
import { App } from './App.tsx';
import { client, queue, subscribe } from './lib/quest.ts';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // На игре сеть рвётся постоянно; агрессивный retry только жжёт батарею.
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root не найден');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <QuestProvider value={{ client, queue, subscribe }}>
        <App />
      </QuestProvider>
    </QueryClientProvider>
  </StrictMode>,
);
