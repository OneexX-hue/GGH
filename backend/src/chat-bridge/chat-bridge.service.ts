import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface ProvisionChatUserInput {
  userId: string;
  displayName: string;
  email?: string;
}

/**
 * Интеграционный слой с Rocket.Chat (ТЗ гл. 5.3, DECISIONS.md — чат-ядро).
 * Наш backend остаётся источником истины по пользователям/ролям — этот
 * сервис только заводит "теневого" пользователя в Rocket.Chat через Admin
 * REST API и выдаёт auth-токен для клиента. Полный докер-деплой
 * Rocket.Chat — отдельный следующий шаг (см. ROADMAP.md), поэтому при
 * отсутствии ROCKETCHAT_BASE_URL сервис работает в режиме no-op и не
 * блокирует регистрацию/логин пользователей в ядре.
 */
@Injectable()
export class ChatBridgeService {
  private readonly logger = new Logger(ChatBridgeService.name);
  private readonly baseUrl?: string;
  private readonly adminToken?: string;
  private readonly adminUserId?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = this.config.get<string>('ROCKETCHAT_BASE_URL');
    this.adminToken = this.config.get<string>('ROCKETCHAT_ADMIN_TOKEN');
    this.adminUserId = this.config.get<string>('ROCKETCHAT_ADMIN_USER_ID');
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.adminToken && this.adminUserId);
  }

  /** Best-effort: ошибки логируются, но не прерывают вызывающий флоу (регистрацию). */
  async provisionUser(input: ProvisionChatUserInput): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(`Rocket.Chat не настроен — пропускаю provisioning для user ${input.userId}`);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': this.adminToken!,
          'X-User-Id': this.adminUserId!,
        },
        body: JSON.stringify({
          name: input.displayName,
          email: input.email,
          username: `carclub_${input.userId.slice(0, 8)}`,
          password: crypto.randomUUID(),
          verified: true,
          joinDefaultChannels: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Rocket.Chat users.create вернул ${response.status}`);
      }

      const body = (await response.json()) as { user?: { _id?: string } };
      if (body.user?._id) {
        await this.prisma.user.update({
          where: { id: input.userId },
          data: { rocketChatUserId: body.user._id },
        });
      }
    } catch (error) {
      this.logger.error(`Не удалось выполнить provisioning в Rocket.Chat: ${(error as Error).message}`);
    }
  }
}
