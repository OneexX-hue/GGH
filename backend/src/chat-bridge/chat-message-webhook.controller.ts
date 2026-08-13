import { Body, Controller, ForbiddenException, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatBridgeService } from './chat-bridge.service';
import { ChatMessageWebhookDto } from './dto/chat-message-webhook.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from '../push/push-notification.service';
import { userIdPrefixFromRcUsername } from './rocketchat-username.util';

/**
 * Push при новых сообщениях чата (ТЗ гл. 3.6) — принимает исходящий
 * вебхук Rocket.Chat (Administration → Integrations → New Outgoing
 * Webhook, событие "Send Message", URL этого эндпоинта, шаблон/скрипт
 * не нужен — RC шлёт JSON по умолчанию). Без JwtAuthGuard намеренно:
 * вызывающая сторона — сам сервер Rocket.Chat, не аутентифицированный
 * пользователь приложения — доступ контролируется общим секретом.
 *
 * ⚠️ Не проверено вживую против реального Rocket.Chat в этой сессии
 * (нет Docker-демона для полноценного RC, мок-сервер не реализует
 * Integrations/исходящие вебхуки) — форма payload'а по документации RC,
 * см. README.md для шагов ручной настройки и честной оговорки.
 *
 * Сейчас — только личные сообщения (roomType 'd'): у RC для DM
 * `rooms.info` отдаёт список участников напрямую (`usernames`), для
 * групп/каналов нужен отдельный вызов (channels.members/groups.members)
 * — вне объёма этой итерации, не реализовано.
 */
@Controller('chat-bridge/webhooks')
export class ChatMessageWebhookController {
  private readonly logger = new Logger(ChatMessageWebhookController.name);
  private readonly secret?: string;

  constructor(
    private readonly chatBridge: ChatBridgeService,
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationService,
    private readonly config: ConfigService,
  ) {
    this.secret = this.config.get<string>('CHAT_MESSAGE_WEBHOOK_SECRET');
  }

  @Post('message')
  async onMessage(@Body() dto: ChatMessageWebhookDto): Promise<{ success: boolean }> {
    if (!this.secret || dto.token !== this.secret) {
      throw new ForbiddenException('Неверный или не настроенный секрет вебхука');
    }

    const room = await this.chatBridge.getRoomInfo(dto.channel_id);
    if (room.t !== 'd' || !room.usernames) {
      this.logger.debug(`Push при сообщении пропущен — комната ${dto.channel_id} не личная (t=${room.t})`);
      return { success: true };
    }

    const recipients = room.usernames.filter((username) => username !== dto.user_name);
    for (const username of recipients) {
      const prefix = userIdPrefixFromRcUsername(username);
      if (!prefix) continue;

      const user = await this.prisma.user.findFirst({ where: { id: { startsWith: prefix } } });
      if (!user) continue;

      // Текст сообщения намеренно не попадает в push (защита секретного
      // чата — превью на заблокированном экране не должно раскрывать
      // содержимое, тот же принцип, что и защита медиа в ТЗ гл. 3.3).
      await this.push.sendToUser(user.id, 'Новое сообщение', 'У вас новое сообщение в чате');
    }

    return { success: true };
  }
}
