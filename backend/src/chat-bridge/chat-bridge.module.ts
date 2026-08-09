import { Module } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';

@Module({
  providers: [ChatBridgeService],
  exports: [ChatBridgeService],
})
export class ChatBridgeModule {}
