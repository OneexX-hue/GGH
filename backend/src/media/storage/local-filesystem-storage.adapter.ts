import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';
import { StorageAdapter } from './storage-adapter.interface';

// Dev/локальная реализация StorageAdapter — пишет зашифрованные блобы на
// диск. Не предназначена для многосерверного/масштабируемого продакшена —
// см. storage-adapter.interface.ts про S3-адаптер.
@Injectable()
export class LocalFilesystemStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    this.rootDir = resolve(config.get<string>('MEDIA_STORAGE_DIR', './storage-data'));
  }

  private resolveKeyPath(key: string): string {
    // Ключи генерируются самим сервисом (uuid), но на всякий случай не
    // позволяем выйти за пределы rootDir через "../".
    const target = normalize(join(this.rootDir, key));
    if (!target.startsWith(this.rootDir + sep) && target !== this.rootDir) {
      throw new NotFoundException('Некорректный ключ хранилища');
    }
    return target;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKeyPath(key));
    } catch {
      throw new NotFoundException('Файл не найден в хранилище');
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKeyPath(key), { force: true });
  }
}
