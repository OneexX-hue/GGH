import { Module } from '@nestjs/common';
import { ModulesRegistryService } from './modules-registry.service';
import { ModulesRegistryController } from './modules-registry.controller';
import { DigestService } from './digest.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ChatBridgeModule } from '../chat-bridge/chat-bridge.module';

@Module({
  imports: [AuditLogModule, ChatBridgeModule],
  providers: [ModulesRegistryService, DigestService],
  controllers: [ModulesRegistryController],
  exports: [ModulesRegistryService],
})
export class ModulesRegistryModule {}
