import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CallsGateway } from './calls.gateway';
import { CallsController } from './calls.controller';
import { CallsHistoryService } from './calls-history.service';
import { CallsPresenceService } from './calls-presence.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-insecure-secret-change-me'),
      }),
    }),
  ],
  controllers: [CallsController],
  providers: [CallsGateway, CallsHistoryService, CallsPresenceService],
})
export class CallsModule {}
