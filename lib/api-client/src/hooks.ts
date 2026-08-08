import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  ClaimQualityRequest,
  GameState,
  Player,
  Scoreboard,
  SubmitCodeRequest,
  SubmitCodeResponse,
  Team,
} from '@workspace/core';
import { clockSkew, computeClock, estimateServerNow } from '@workspace/core';
import { ApiError, type TasksResponse } from './client.ts';
import { useQuest } from './provider.tsx';

export const queryKeys = {
  gameState: ['game-state'] as const,
  tasks: ['tasks'] as const,
  scoreboard: ['scoreboard'] as const,
  me: ['me'] as const,
  qualityCodes: ['quality-codes'] as const,
};

/**
 * Состояние игры. Опрос редкий (30 с) и служит подстраховкой: основной канал
 * обновлений — подписка из useLiveUpdates.
 */
export function useGameState(): UseQueryResult<GameState> {
  const { client } = useQuest();
  return useQuery({ queryKey: queryKeys.gameState, queryFn: () => client.gameState(), refetchInterval: 30_000 });
}

export function useMe(): UseQueryResult<{ player: Player; team: Team }> {
  const { client } = useQuest();
  // Игрок и команда не меняются по ходу игры — перезапрашивать их незачем.
  return useQuery({ queryKey: queryKeys.me, queryFn: () => client.me(), staleTime: Infinity });
}

export function useTasks(enabled = true): UseQueryResult<TasksResponse> {
  const { client } = useQuest();
  return useQuery({ queryKey: queryKeys.tasks, queryFn: () => client.tasks(), enabled });
}

export function useScoreboard(): UseQueryResult<Scoreboard> {
  const { client } = useQuest();
  return useQuery({ queryKey: queryKeys.scoreboard, queryFn: () => client.scoreboard(), refetchInterval: 30_000 });
}

export function useQualityCodes(enabled = true) {
  const { client } = useQuest();
  return useQuery({ queryKey: queryKeys.qualityCodes, queryFn: () => client.qualityCodes(), enabled });
}

/**
 * Таймер, тикающий раз в секунду локально.
 *
 * Сеть дёргается редко, но показания остаются серверными: из ответа берётся
 * поправка часов (skew), и дальше локальный тик считает через неё. Перевод
 * времени на устройстве не влияет на отображаемый остаток.
 */
export function useGameClock(state: GameState | undefined) {
  const [tick, setTick] = useState(() => Date.now());
  const skewRef = useRef(0);

  if (state) skewRef.current = clockSkew(state.serverTime);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!state) return { remainingMs: 0, elapsedMs: 0, isRunning: false, isOver: false };
    return computeClock(state.event, estimateServerNow(skewRef.current, tick));
  }, [state, tick]);
}

/**
 * Подписка на серверные события: при изменении игры инвалидируются кэши,
 * и React Query перезапрашивает то, что сейчас на экране.
 */
export function useLiveUpdates(): void {
  const { subscribe } = useQuest();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!subscribe) return;
    return subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gameState });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard });
    });
  }, [subscribe, queryClient]);
}

/**
 * Отправка кода с офлайн-очередью.
 *
 * Сетевая ошибка не показывается игроку как провал: попытка кладётся в очередь
 * и уходит, когда появится сеть. Отказ сервера по существу («не тот код»)
 * возвращается сразу.
 */
export function useSubmitCode() {
  const { client, queue } = useQuest();
  const queryClient = useQueryClient();

  return useMutation<SubmitCodeResponse | 'queued', Error, SubmitCodeRequest>({
    mutationFn: async (body) => {
      try {
        const result = await client.submitCode(body);
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        void queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard });
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.isRetryable) {
          await queue.enqueue(body, body.idempotencyKey);
          return 'queued';
        }
        throw error;
      }
    },
  });
}

export function useClaimQuality() {
  const { client } = useQuest();
  const queryClient = useQueryClient();

  return useMutation<SubmitCodeResponse, Error, ClaimQualityRequest>({
    mutationFn: async (body) => {
      const result = await client.claimQuality(body);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard });
      return result;
    },
  });
}

/**
 * Фоновая досылка накопленной офлайн-очереди.
 * Возвращает число ожидающих отправок — его показывают игроку, чтобы он видел,
 * что введённые в подвале коды не потерялись.
 */
export function useQueueFlush(intervalMs = 15_000): number {
  const { client, queue } = useQuest();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = await queue.flush(async (payload) => {
        await client.submitCode(payload);
      });
      if (cancelled) return;
      setPending(result.remaining);
      if (result.sent > 0) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        void queryClient.invalidateQueries({ queryKey: queryKeys.scoreboard });
      }
    };

    void run();
    const id = setInterval(() => void run(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, queue, queryClient, intervalMs]);

  return pending;
}
