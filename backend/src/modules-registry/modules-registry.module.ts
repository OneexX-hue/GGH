import { Module } from '@nestjs/common';
import { ModulesRegistryService } from './modules-registry.service';
import { ModulesRegistryController } from './modules-registry.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [ModulesRegistryService],
  controllers: [ModulesRegistryController],
  exports: [ModulesRegistryService],
})
export class ModulesRegistryModule {}
