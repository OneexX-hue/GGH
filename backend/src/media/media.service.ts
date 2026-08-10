import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ChatMediaKind, MediaAccessAction, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { decryptMedia, encryptMedia } from './media-crypto.util';
import { STORAGE_ADAPTER, StorageAdapter } from './storage/storage-adapter.interface';

const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
const MEDIA_TOKEN_PURPOSE = 'media-access';

interface MediaTokenPayload {
  sub: string; // viewerUserId
  mediaId: string;
  purpose: typeof MEDIA_TOKEN_PURPOSE;
}

const MIME_TO_KIND: Record<string, ChatMediaKind> = {
  'image/jpeg': ChatMediaKind.PHOTO,
  'image/png': ChatMediaKind.PHOTO,
  'image/webp': ChatMediaKind.PHOTO,
  'video/mp4': ChatMediaKind.VIDEO,
  'video/quicktime': ChatMediaKind.VIDEO,
};

@Injectable()
export class MediaService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {
    const secret = this.config.get<string>('MEDIA_ENCRYPTION_KEY', 'dev-insecure-media-key-change-me');
    // SHA-256 сводит секрет любой длины к ровно 32 байтам, требуемым AES-256.
    this.encryptionKey = createHash('sha256').update(secret).digest();
  }

  async upload(uploaderUserId: string, file: Express.Multer.File) {
    const kind = MIME_TO_KIND[file.mimetype];
    if (!kind) {
      throw new BadRequestException(`Неподдерживаемый тип файла: ${file.mimetype}`);
    }

    const id = randomUUID();
    const { ciphertext, iv, authTag } = encryptMedia(file.buffer, this.encryptionKey);
    await this.storage.put(id, ciphertext);

    const media = await this.prisma.chatMedia.create({
      data: {
        id,
        uploaderUserId,
        kind,
        storageKey: id,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        iv,
        authTag,
      },
    });

    return { mediaId: media.id, kind: media.kind };
  }

  async issueAccessToken(mediaId: string, viewerUserId: string) {
    const media = await this.prisma.chatMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Медиафайл не найден');

    const payload: MediaTokenPayload = { sub: viewerUserId, mediaId, purpose: MEDIA_TOKEN_PURPOSE };
    const token = this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
    return { token, expiresAt };
  }

  async getContent(mediaId: string, token: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const viewerUserId = this.validateAccessToken(mediaId, token);

    const media = await this.prisma.chatMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Медиафайл не найден');

    const ciphertext = await this.storage.get(media.storageKey);
    const plaintext = decryptMedia(ciphertext, this.encryptionKey, media.iv, media.authTag);

    let output = plaintext;
    if (media.kind === ChatMediaKind.PHOTO) {
      const viewer = await this.prisma.user.findUnique({ where: { id: viewerUserId } });
      output = await this.applyWatermark(plaintext, viewer?.displayName ?? viewerUserId);
    }
    // VIDEO — без водяного знака в этом этапе (см. docs/DECISIONS.md,
    // "Водяной знак на видео (ffmpeg) — не решено").

    await this.prisma.mediaAccessLog.create({
      data: { mediaId, viewerUserId, action: MediaAccessAction.VIEW },
    });

    return { buffer: output, mimeType: media.mimeType };
  }

  /**
   * Журнал доступа для модерации (ТЗ гл. 3.7) — в первую очередь для
   * просмотра SCREENSHOT_DETECTED. Права проверяются на уровне
   * контроллера (chat.moderate), не здесь.
   */
  async listAccessLog(params: { action?: MediaAccessAction; skip?: number; take?: number }) {
    return this.prisma.mediaAccessLog.findMany({
      where: params.action ? { action: params.action } : undefined,
      skip: params.skip ?? 0,
      take: params.take ?? 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        media: { select: { id: true, kind: true, uploader: { select: { id: true, displayName: true } } } },
        viewer: { select: { id: true, displayName: true } },
      },
    });
  }

  async logAccessEvent(
    mediaId: string,
    viewerUserId: string,
    action: 'DOWNLOAD_ATTEMPT' | 'SCREENSHOT_DETECTED',
    metadata?: Record<string, unknown>,
  ) {
    const media = await this.prisma.chatMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Медиафайл не найден');

    await this.prisma.mediaAccessLog.create({
      data: {
        mediaId,
        viewerUserId,
        action: action === 'DOWNLOAD_ATTEMPT' ? MediaAccessAction.DOWNLOAD_ATTEMPT : MediaAccessAction.SCREENSHOT_DETECTED,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  private validateAccessToken(mediaId: string, token: string): string {
    let payload: MediaTokenPayload;
    try {
      payload = this.jwt.verify<MediaTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Недействительный или истёкший токен доступа к медиа');
    }
    if (payload.purpose !== MEDIA_TOKEN_PURPOSE || payload.mediaId !== mediaId) {
      throw new UnauthorizedException('Токен не подходит для этого медиафайла');
    }
    return payload.sub;
  }

  /**
   * Динамический водяной знак (имя получателя + время просмотра) —
   * рендерится на каждый запрос, "чистая" версия никогда не пишется на
   * диск в раздаваемом виде (ТЗ гл. 3.3).
   */
  private async applyWatermark(image: Buffer, viewerLabel: string): Promise<Buffer> {
    const stamp = `${viewerLabel} · ${new Date().toISOString()}`;
    const escaped = stamp.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const pipeline = sharp(image);
    const metadata = await pipeline.metadata();
    const imageWidth = metadata.width ?? 500;
    const imageHeight = metadata.height ?? 40;
    // composite() требует, чтобы наложение было не больше базового изображения —
    // подгоняем размер плашки под реальные размеры фото, не только под текст.
    const svgWidth = Math.min(500, imageWidth);
    const svgHeight = Math.min(40, imageHeight);
    const fontSize = Math.max(10, Math.round(svgHeight * 0.45));

    const svg = `
      <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" />
        <text x="10" y="${svgHeight - Math.round(svgHeight * 0.3)}" font-size="${fontSize}" fill="white" font-family="sans-serif">${escaped}</text>
      </svg>`;

    return pipeline
      .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
      .toBuffer();
  }
}
