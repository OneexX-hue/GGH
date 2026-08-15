import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Отправка push-уведомлений через Expo Push API — не нужен отдельный
// APNs/FCM ключ на этом этапе (mobile/, LICENSING.md — expo-notifications).
// Best-effort: сбой отправки не должен ронять вызывающую бизнес-логику
// (начисление баллов, модерацию LPR и т.д.), поэтому ошибки только логируются.
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
    if (!user?.pushToken) return;

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: user.pushToken, title, body, data }),
      });
      if (!response.ok) {
        this.logger.warn(`Expo Push API вернул ${response.status} для пользователя ${userId}`);
      }
    } catch (error) {
      this.logger.warn(`Не удалось отправить push пользователю ${userId}: ${(error as Error).message}`);
    }
  }
}
