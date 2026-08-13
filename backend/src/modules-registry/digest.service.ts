import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';

const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // раз в час

/**
 * Кросс-модульный дайджест в чат (ТЗ гл. 3.6) — сводка событий по ВСЕМ
 * модулям сразу, в дополнение к уже существующим точечным анонсам
 * каждого модуля (auto-quest/hide-and-seek постят анонс при каждом
 * начислении в свою announceRoomId). Опционален — без DIGEST_ROOM_ID в
 * .env таймер не запускается вообще, а не крутится вхолостую.
 *
 * Точка отсчёта "последний дайджест" — в памяти процесса, не в БД:
 * при перезапуске backend теряется (первый дайджест после рестарта
 * может задвоить события за последний час) — тот же класс упрощения,
 * что уже принят для presence в CallsGateway (см. docs/DECISIONS.md).
 */
@Injectable()
export class DigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestService.name);
  private timer?: NodeJS.Timeout;
  private lastDigestAt = new Date();
  private readonly roomId?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatBridge: ChatBridgeService,
    private readonly config: ConfigService,
  ) {
    this.roomId = this.config.get<string>('DIGEST_ROOM_ID');
  }

  onModuleInit(): void {
    if (!this.roomId) {
      this.logger.warn('DIGEST_ROOM_ID не задан — кросс-модульный дайджест в чат отключён');
      return;
    }
    this.timer = setInterval(() => void this.postDigest(), DIGEST_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async postDigest(): Promise<void> {
    if (!this.roomId) return;

    const since = this.lastDigestAt;
    const now = new Date();

    const events = await this.prisma.statEvent.findMany({
      where: { occurredAt: { gt: since, lte: now } },
      select: { moduleKey: true, points: true, moduleDef: { select: { name: true } } },
    });

    this.lastDigestAt = now;
    if (events.length === 0) return;

    const totalsByModule = new Map<string, { name: string; points: number; count: number }>();
    for (const event of events) {
      const entry = totalsByModule.get(event.moduleKey) ?? { name: event.moduleDef.name, points: 0, count: 0 };
      entry.points += event.points;
      entry.count += 1;
      totalsByModule.set(event.moduleKey, entry);
    }

    const totalPoints = events.reduce((sum, e) => sum + e.points, 0);
    const perModule = [...totalsByModule.values()]
      .map((m) => `${m.name}: ${m.count} событий, +${m.points} баллов`)
      .join('; ');

    const text = `📊 Дайджест за последний час: всего ${events.length} событий, +${totalPoints} баллов. ${perModule}`;

    try {
      await this.chatBridge.postSystemMessage(this.roomId, text);
    } catch (error) {
      this.logger.warn(`Не удалось опубликовать дайджест: ${(error as Error).message}`);
    }
  }
}
