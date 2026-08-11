import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatBridgeService } from './chat-bridge.service';

const SWEEP_INTERVAL_MS = 15_000;

/**
 * Реальное (не декоративное) удаление просроченных самоуничтожающихся
 * сообщений — периодически проверяет ExpiringMessage и вызывает
 * ChatBridgeService.deleteMessage. Строка остаётся в БД, если удаление
 * не удалось (RC временно недоступен) — подхватится следующим циклом,
 * не теряется молча.
 */
@Injectable()
export class MessageExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageExpiryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatBridge: ChatBridgeService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    const due = await this.prisma.expiringMessage.findMany({
      where: { expiresAt: { lte: new Date() } },
      take: 50,
    });

    for (const entry of due) {
      try {
        await this.chatBridge.deleteMessage(entry.roomId, entry.msgId);
        await this.prisma.expiringMessage.delete({ where: { id: entry.id } });
      } catch (error) {
        this.logger.warn(`Не удалось удалить просроченное сообщение ${entry.msgId}: ${(error as Error).message}`);
      }
    }
  }
}
