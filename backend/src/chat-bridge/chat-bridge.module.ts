import { Module } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';
import { ChatBridgeController } from './chat-bridge.controller';

@Module({
  providers: [ChatBridgeService],
  controllers: [ChatBridgeController],
  exports: [ChatBridgeService],
})
export class ChatBridgeModule {}
