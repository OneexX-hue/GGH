import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ChatBridgeModule } from '../chat-bridge/chat-bridge.module';

@Module({
  imports: [AuditLogModule, ChatBridgeModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
