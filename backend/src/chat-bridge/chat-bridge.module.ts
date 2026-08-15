import { Module } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';
import { ChatBridgeController } from './chat-bridge.controller';
import { ChatModerationController } from './chat-moderation.controller';
import { ChatMessageWebhookController } from './chat-message-webhook.controller';
import { MessageExpiryService } from './message-expiry.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [ChatBridgeService, MessageExpiryService],
  controllers: [ChatBridgeController, ChatModerationController, ChatMessageWebhookController],
  exports: [ChatBridgeService],
})
export class ChatBridgeModule {}
