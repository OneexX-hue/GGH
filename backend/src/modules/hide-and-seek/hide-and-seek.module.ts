import { Module } from '@nestjs/common';
import { RoundsService } from './rounds.service';
import { RoundParticipationService } from './round-participation.service';
import { RoundsController } from './rounds.controller';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ModulesRegistryModule } from '../../modules-registry/modules-registry.module';
import { ChatBridgeModule } from '../../chat-bridge/chat-bridge.module';

@Module({
  imports: [AuditLogModule, ModulesRegistryModule, ChatBridgeModule],
  providers: [RoundsService, RoundParticipationService],
  controllers: [RoundsController],
})
export class HideAndSeekModule {}
