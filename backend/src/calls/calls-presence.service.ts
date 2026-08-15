import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const ONLINE_SET_KEY = 'calls:online';
const RELAY_CHANNEL = 'calls:relay';

export interface RelayMessage {
  targetUserId: string;
  event: string;
  data: unknown;
}

/**
 * Presence + relay для CallsGateway на несколько backend-инстансов
 * (docs/DECISIONS.md, "Масштабирование на несколько инстансов").
 * Использует Valkey (BSD-3-Clause, Redis-протокол-совместимый форк —
 * см. docs/LICENSING.md почему не сам Redis) через `ioredis`.
 *
 * Опционально: без VALKEY_URL в .env сервис работает в режиме no-op —
 * CallsGateway тогда обслуживает только один процесс (прежнее
 * поведение), не падает и не требует Valkey для локальной разработки.
 */
@Injectable()
export class CallsPresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallsPresenceService.name);
  private readonly url?: string;
  private pubClient?: Redis;
  private subClient?: Redis;
  private onRelayMessage?: (message: RelayMessage) => void;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('VALKEY_URL');
  }

  get enabled(): boolean {
    return Boolean(this.url);
  }

  setOnRelayMessage(handler: (message: RelayMessage) => void): void {
    this.onRelayMessage = handler;
  }

  onModuleInit(): void {
    if (!this.url) {
      this.logger.warn('VALKEY_URL не задан — сигнализация звонков работает только на одном backend-инстансе');
      return;
    }

    // ioredis требует отдельное соединение для подписки — на нём нельзя
    // выполнять обычные команды (SADD/SREM/PUBLISH), только (un)subscribe.
    this.pubClient = new Redis(this.url);
    this.subClient = new Redis(this.url);

    this.subClient.subscribe(RELAY_CHANNEL).catch((error) => {
      this.logger.error(`Не удалось подписаться на ${RELAY_CHANNEL}: ${(error as Error).message}`);
    });

    this.subClient.on('message', (_channel, raw) => {
      if (!this.onRelayMessage) return;
      try {
        this.onRelayMessage(JSON.parse(raw) as RelayMessage);
      } catch {
        // повреждённое сообщение — игнорируем, не роняем подписчика
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pubClient?.quit().catch(() => {});
    await this.subClient?.quit().catch(() => {});
  }

  async markOnline(userId: string): Promise<void> {
    if (!this.pubClient) return;
    await this.pubClient.sadd(ONLINE_SET_KEY, userId).catch((error) => {
      this.logger.warn(`markOnline(${userId}) не удался: ${(error as Error).message}`);
    });
  }

  async markOffline(userId: string): Promise<void> {
    if (!this.pubClient) return;
    await this.pubClient.srem(ONLINE_SET_KEY, userId).catch((error) => {
      this.logger.warn(`markOffline(${userId}) не удался: ${(error as Error).message}`);
    });
  }

  async isOnlineAnywhere(userId: string): Promise<boolean> {
    if (!this.pubClient) return false;
    try {
      return (await this.pubClient.sismember(ONLINE_SET_KEY, userId)) === 1;
    } catch (error) {
      this.logger.warn(`isOnlineAnywhere(${userId}) не удался: ${(error as Error).message}`);
      return false;
    }
  }

  async publishRelay(message: RelayMessage): Promise<void> {
    if (!this.pubClient) return;
    await this.pubClient.publish(RELAY_CHANNEL, JSON.stringify(message)).catch((error) => {
      this.logger.warn(`publishRelay не удался: ${(error as Error).message}`);
    });
  }
}
