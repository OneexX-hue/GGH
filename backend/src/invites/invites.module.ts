import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { ApplicationsService } from './applications.service';
import { InvitesController } from './invites.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [InvitesService, ApplicationsService],
  controllers: [InvitesController],
  exports: [InvitesService, ApplicationsService],
})
export class InvitesModule {}
