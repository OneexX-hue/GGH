import { Controller, Post, UseGuards } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';
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
}
