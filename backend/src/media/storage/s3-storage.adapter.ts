import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { StorageAdapter } from './storage-adapter.interface';

// S3-совместимый адаптер (docs/DECISIONS.md — "Хранилище медиа в чате")
// — работает с любым провайдером, реализующим S3 API (AWS S3, MinIO,
// Yandex Object Storage), через настраиваемый endpoint, не завязан на
// конкретное облако (см. docs/DECISIONS.md, "Хостинг" — провайдер ещё
// не выбран). Байты, приходящие сюда, уже зашифрованы вызывающей
// стороной (MediaService/LprService) — этот адаптер хранит ciphertext
// как есть, шифрование at rest не его ответственность.
//
// Конфиг читается лениво (не в конструкторе): этот провайдер регистрируется
// в MediaModule безусловно (см. media.module.ts), даже когда
// MEDIA_STORAGE_DRIVER=local и S3-переменные не заданы — эагерная проверка
// в конструкторе уронила бы приложение на старте в дефолтной dev-конфигурации.
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client | null = null;
  private bucket = '';

  constructor(private readonly config: ConfigService) {}

  private ensureClient(): S3Client {
    if (this.client) return this.client;

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    this.bucket = this.config.get<string>('S3_BUCKET', '');

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error(
        'S3StorageAdapter выбран (MEDIA_STORAGE_DRIVER=s3), но не заданы S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET в .env',
      );
    }

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // нужно для MinIO/большинства не-AWS S3-совместимых бэкендов
    });
    return this.client;
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.ensureClient().send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }));
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.ensureClient().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.ensureClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
