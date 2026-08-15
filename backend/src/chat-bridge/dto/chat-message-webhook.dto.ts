import { IsOptional, IsString } from 'class-validator';

// Форма payload'а исходящего вебхука Rocket.Chat (Administration →
// Integrations → New Outgoing Webhook, событие "Send Message") — поля
// по документации RC, не проверено вживую против реального RC в этой
// сессии (см. README.md).
export class ChatMessageWebhookDto {
  @IsString()
  token!: string;

  @IsString()
  channel_id!: string;

  @IsString()
  user_name!: string;

  @IsOptional()
  @IsString()
  text?: string;
}
