import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { rocketChatUsernameFor } from './rocketchat-username.util';

export interface ProvisionChatUserInput {
  userId: string;
  displayName: string;
  email?: string;
}

export interface ChatSession {
  baseUrl: string;
  wsUrl: string;
  rocketChatUserId: string;
  authToken: string;
}

export type ModerationRoomType = 'd' | 'p' | 'c';

export interface ModerationRoom {
  _id: string;
  t: ModerationRoomType;
  name?: string;
  fname?: string;
  msgs?: number;
  usersCount?: number;
  ts?: string;
}

export interface ModerationMessage {
  _id: string;
  rid: string;
  msg: string;
  ts: string;
  u: { _id: string; username: string; name?: string };
}

const HISTORY_ENDPOINT_BY_ROOM_TYPE: Record<ModerationRoomType, string> = {
  d: 'im.history',
  p: 'groups.history',
  c: 'channels.history',
};

/**
 * Интеграционный слой с Rocket.Chat (ТЗ гл. 5.3, DECISIONS.md — чат-ядро).
 * Наш backend остаётся источником истины по пользователям/ролям — этот
 * сервис заводит "теневого" пользователя в Rocket.Chat через Admin REST API
 * и выдаёт клиенту auth-токен для прямой работы с REST/Realtime API RC
 * (клиент после этого общается с Rocket.Chat напрямую — см.
 * mobile/src/rocketchat/). При отсутствии конфигурации сервис работает в
 * режиме no-op и не блокирует регистрацию/логин пользователей в ядре.
 */
@Injectable()
export class ChatBridgeService {
  private readonly logger = new Logger(ChatBridgeService.name);
  private readonly baseUrl?: string;
  private readonly wsUrl?: string;
  private readonly adminToken?: string;
  private readonly adminUserId?: string;
  private readonly createTokensSecret?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = this.config.get<string>('ROCKETCHAT_BASE_URL');
    this.wsUrl = this.config.get<string>('ROCKETCHAT_WS_URL');
    this.adminToken = this.config.get<string>('ROCKETCHAT_ADMIN_TOKEN');
    this.adminUserId = this.config.get<string>('ROCKETCHAT_ADMIN_USER_ID');
    this.createTokensSecret = this.config.get<string>('CREATE_TOKENS_FOR_USERS_SECRET');
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
        headers: this.adminHeaders(),
        body: JSON.stringify({
          name: input.displayName,
          email: input.email,
          username: rocketChatUsernameFor(input.userId),
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

  /**
   * Выдаёт клиенту одноразовую сессию Rocket.Chat: admin-issued auth-токен
   * для пользователя (через users.createToken), не требует пароля RC.
   * Требует настроенный на самом сервере Rocket.Chat env-параметр
   * CREATE_TOKENS_FOR_USERS_SECRET (см. infra/docker-compose.yml).
   */
  async createSession(userId: string): Promise<ChatSession> {
    if (!this.isConfigured() || !this.wsUrl || !this.createTokensSecret) {
      throw new ServiceUnavailableException('Чат временно недоступен: Rocket.Chat не сконфигурирован');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.rocketChatUserId) {
      throw new ServiceUnavailableException(
        'Профиль ещё не заведён в чате — попробуйте через несколько секунд после регистрации',
      );
    }

    const response = await this.rocketChatFetch('/api/v1/users.createToken', {
      method: 'POST',
      headers: this.adminHeaders(),
      body: JSON.stringify({ userId: user.rocketChatUserId, secret: this.createTokensSecret }),
    });

    if (!response.ok) {
      throw new BadGatewayException(`Rocket.Chat users.createToken вернул ${response.status}`);
    }

    const body = (await response.json()) as { data?: { authToken?: string; userId?: string } };
    if (!body.data?.authToken || !body.data.userId) {
      throw new BadGatewayException('Rocket.Chat не вернул authToken');
    }

    return {
      baseUrl: this.baseUrl!,
      wsUrl: this.wsUrl,
      rocketChatUserId: body.data.userId,
      authToken: body.data.authToken,
    };
  }

  /**
   * Модерация (ТЗ гл. 3.7): список всех комнат через admin REST API RC.
   * Требует на стороне Rocket.Chat права view-room-administration у
   * пользователя ROCKETCHAT_ADMIN_USER_ID.
   */
  async listRooms(params: { count?: number; offset?: number } = {}): Promise<ModerationRoom[]> {
    this.assertConfigured();

    const query = new URLSearchParams();
    if (params.count) query.set('count', String(params.count));
    if (params.offset) query.set('offset', String(params.offset));

    const response = await this.rocketChatFetch(`/api/v1/rooms.adminRooms?${query.toString()}`, {
      headers: this.adminHeaders(),
    });
    if (!response.ok) {
      throw new BadGatewayException(`Rocket.Chat rooms.adminRooms вернул ${response.status}`);
    }

    const body = (await response.json()) as { rooms?: ModerationRoom[] };
    return body.rooms ?? [];
  }

  async getRoomHistory(roomId: string, roomType: ModerationRoomType, count = 50): Promise<ModerationMessage[]> {
    this.assertConfigured();

    const endpoint = HISTORY_ENDPOINT_BY_ROOM_TYPE[roomType];
    const response = await this.rocketChatFetch(
      `/api/v1/${endpoint}?roomId=${encodeURIComponent(roomId)}&count=${count}`,
      { headers: this.adminHeaders() },
    );
    if (!response.ok) {
      throw new BadGatewayException(`Rocket.Chat ${endpoint} вернул ${response.status}`);
    }

    const body = (await response.json()) as { messages?: ModerationMessage[] };
    return body.messages ?? [];
  }

  async deleteMessage(roomId: string, msgId: string): Promise<void> {
    this.assertConfigured();

    const response = await this.rocketChatFetch('/api/v1/chat.delete', {
      method: 'POST',
      headers: this.adminHeaders(),
      body: JSON.stringify({ roomId, msgId }),
    });
    if (!response.ok) {
      throw new BadGatewayException(`Rocket.Chat chat.delete вернул ${response.status}`);
    }
  }

  /**
   * Best-effort (как и provisionUser): используется из UsersService.ban,
   * не должен блокировать бан в ядре, если Rocket.Chat недоступен/не
   * настроен.
   */
  async setUserActive(rocketChatUserId: string, active: boolean): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(`Rocket.Chat не настроен — пропускаю смену активности для ${rocketChatUserId}`);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users.setActiveStatus`, {
        method: 'POST',
        headers: this.adminHeaders(),
        body: JSON.stringify({ userId: rocketChatUserId, activeStatus: active }),
      });
      if (!response.ok) {
        throw new Error(`Rocket.Chat users.setActiveStatus вернул ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Не удалось изменить активность пользователя в Rocket.Chat: ${(error as Error).message}`);
    }
  }

  /**
   * Best-effort (как и setUserActive): публикация системного сообщения от
   * имени администратора (например, объявление о погашении чекпоинта
   * квеста, ТЗ гл. 3.6). Не должна ронять вызывающий флоу, если
   * Rocket.Chat недоступен/не настроен или комната не указана.
   */
  async postSystemMessage(roomId: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(`Rocket.Chat не настроен — пропускаю публикацию сообщения в ${roomId}`);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/chat.postMessage`, {
        method: 'POST',
        headers: this.adminHeaders(),
        body: JSON.stringify({ roomId, text }),
      });
      if (!response.ok) {
        throw new Error(`Rocket.Chat chat.postMessage вернул ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Не удалось опубликовать сообщение в Rocket.Chat: ${(error as Error).message}`);
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Модерация чата недоступна: Rocket.Chat не сконфигурирован');
    }
  }

  /**
   * Оборачивает fetch() к Rocket.Chat: сетевой сбой (сервис недоступен,
   * DNS и т.п.) раньше улетал наружу как непойманный TypeError и
   * превращался в голый "Internal server error" вместо понятного ответа —
   * см. README.md, обнаружено при верификации модерации.
   */
  private async rocketChatFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, init);
    } catch (error) {
      throw new BadGatewayException(`Rocket.Chat недоступен: ${(error as Error).message}`);
    }
  }

  private adminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Auth-Token': this.adminToken!,
      'X-User-Id': this.adminUserId!,
    };
  }
}
