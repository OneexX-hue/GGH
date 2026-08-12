import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { STORAGE_ADAPTER } from './storage/storage-adapter.interface';
import { LocalFilesystemStorageAdapter } from './storage/local-filesystem-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';

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
  providers: [
    MediaService,
    {
      provide: STORAGE_ADAPTER,
      // MEDIA_STORAGE_DRIVER=s3 включает S3-совместимый адаптер (прод,
      // требует S3_ENDPOINT/S3_BUCKET/... — см. docs/DECISIONS.md,
      // "Хранилище медиа в чате"); по умолчанию — локальная ФС (dev).
      useFactory: (config: ConfigService, s3: S3StorageAdapter, local: LocalFilesystemStorageAdapter) =>
        config.get<string>('MEDIA_STORAGE_DRIVER', 'local') === 's3' ? s3 : local,
      inject: [ConfigService, S3StorageAdapter, LocalFilesystemStorageAdapter],
    },
    S3StorageAdapter,
    LocalFilesystemStorageAdapter,
  ],
  controllers: [MediaController],
  exports: [MediaService, STORAGE_ADAPTER],
})
export class MediaModule {}
