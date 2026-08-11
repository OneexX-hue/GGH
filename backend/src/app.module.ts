import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { InvitesModule } from './invites/invites.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ModulesRegistryModule } from './modules-registry/modules-registry.module';
import { ChatBridgeModule } from './chat-bridge/chat-bridge.module';
import { MediaModule } from './media/media.module';
import { AutoQuestModule } from './modules/auto-quest/auto-quest.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]), // глобальный дефолт, эндпоинты auth переопределяют строже
    PrismaModule,
    AuditLogModule,
    AuthModule,
    InvitesModule,
    UsersModule,
    RolesModule,
    ModulesRegistryModule,
    ChatBridgeModule,
    MediaModule,
    AutoQuestModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
