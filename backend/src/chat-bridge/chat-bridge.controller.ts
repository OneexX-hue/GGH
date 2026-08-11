import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';
import { ExpireAtDto } from './dto/expire-at.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('chat-bridge')
@UseGuards(JwtAuthGuard)
export class ChatBridgeController {
  constructor(private readonly chatBridgeService: ChatBridgeService) {}

  @Post('session')
  createSession(@CurrentUser() user: AuthenticatedUser) {
    return this.chatBridgeService.createSession(user.userId);
  }

  /** Самоуничтожающиеся сообщения — доступно любому участнику для своих сообщений. */
  @Post('messages/:roomId/:msgId/expire-at')
  async scheduleExpiry(@Param('roomId') roomId: string, @Param('msgId') msgId: string, @Body() dto: ExpireAtDto) {
    await this.chatBridgeService.scheduleExpiry(roomId, msgId, new Date(dto.expiresAt));
    return { success: true };
  }
}
