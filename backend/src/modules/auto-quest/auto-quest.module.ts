import { Module } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { QuestParticipationService } from './quest-participation.service';
import { QuestsController } from './quests.controller';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ModulesRegistryModule } from '../../modules-registry/modules-registry.module';
import { ChatBridgeModule } from '../../chat-bridge/chat-bridge.module';

@Module({
  imports: [AuditLogModule, ModulesRegistryModule, ChatBridgeModule],
  providers: [QuestsService, QuestParticipationService],
  controllers: [QuestsController],
})
export class AutoQuestModule {}
