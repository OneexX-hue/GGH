import { Module } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';
import { ChatBridgeController } from './chat-bridge.controller';
import { ChatModerationController } from './chat-moderation.controller';

@Module({
  providers: [ChatBridgeService],
  controllers: [ChatBridgeController, ChatModerationController],
  exports: [ChatBridgeService],
})
export class ChatBridgeModule {}
