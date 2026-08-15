import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TotpService } from './totp.service';
import { InvitesModule } from '../invites/invites.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ChatBridgeModule } from '../chat-bridge/chat-bridge.module';

@Module({
  imports: [
    PassportModule,
    InvitesModule,
    AuditLogModule,
    ChatBridgeModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-insecure-secret-change-me'),
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, TotpService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
