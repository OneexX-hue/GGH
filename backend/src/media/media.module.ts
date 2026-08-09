import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { STORAGE_ADAPTER } from './storage/storage-adapter.interface';
import { LocalFilesystemStorageAdapter } from './storage/local-filesystem-storage.adapter';

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
  providers: [MediaService, { provide: STORAGE_ADAPTER, useClass: LocalFilesystemStorageAdapter }],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
