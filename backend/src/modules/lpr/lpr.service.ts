import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LprSubmissionStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ModulesRegistryService } from '../../modules-registry/modules-registry.service';
import { encryptMedia, decryptMedia } from '../../media/media-crypto.util';
import { STORAGE_ADAPTER, StorageAdapter } from '../../media/storage/storage-adapter.interface';
import { LPR_ADAPTER, LprAdapter, LprNotConfiguredError } from './adapters/lpr-adapter.interface';

const MODULE_KEY = 'lpr-scoring';
// Ниже этого порога уверенности распознавания — не начислять баллы
// автоматически, отправлять на ручную модерацию (ТЗ 3.7).
const AUTO_CONFIRM_THRESHOLD = 0.85;
const DEFAULT_POINTS_PER_RECOGNITION = 5;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class LprService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly modulesRegistry: ModulesRegistryService,
    @Inject(LPR_ADAPTER) private readonly adapter: LprAdapter,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {
    const secret = this.config.get<string>('MEDIA_ENCRYPTION_KEY', 'dev-insecure-media-key-change-me');
    this.encryptionKey = createHash('sha256').update(secret).digest();
  }

  async submit(userId: string, file: Express.Multer.File) {
    await this.modulesRegistry.assertEnabled(MODULE_KEY);

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Неподдерживаемый тип файла: ${file.mimetype}`);
    }

    let recognition: { plate: string | null; confidence: number | null };
    try {
      recognition = await this.adapter.recognize(file.buffer);
    } catch (error) {
      if (error instanceof LprNotConfiguredError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }

    const id = randomUUID();
    const { ciphertext, iv, authTag } = encryptMedia(file.buffer, this.encryptionKey);
    await this.storage.put(id, ciphertext);

    const autoConfirm =
      recognition.plate !== null && recognition.confidence !== null && recognition.confidence >= AUTO_CONFIRM_THRESHOLD;

    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lprSubmission.create({
        data: {
          id,
          submittedByUserId: userId,
          storageKey: id,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          iv,
          authTag,
          detectedPlate: recognition.plate,
          confidence: recognition.confidence,
          status: autoConfirm ? LprSubmissionStatus.CONFIRMED : LprSubmissionStatus.PENDING,
        },
      });

      if (!autoConfirm) return created;

      const moduleDef = await tx.moduleDefinition.findUnique({ where: { key: MODULE_KEY } });
      const points =
        (moduleDef?.config as { pointsPerRecognition?: number } | null)?.pointsPerRecognition ??
        DEFAULT_POINTS_PER_RECOGNITION;

      const { statEvent } = await this.modulesRegistry.applyStatEventWithinTransaction(tx, {
        moduleKey: MODULE_KEY,
        userId,
        points,
        reason: `Распознан номер ${recognition.plate}`,
        occurredAt: new Date(),
        metadata: { submissionId: created.id, confidence: recognition.confidence },
      });

      return tx.lprSubmission.update({
        where: { id: created.id },
        data: { points, statEventId: statEvent.id },
      });
    });

    return this.toDto(submission);
  }

  async listMine(userId: string) {
    const submissions = await this.prisma.lprSubmission.findMany({
      where: { submittedByUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map((s) => this.toDto(s));
  }

  async listPending() {
    const submissions = await this.prisma.lprSubmission.findMany({
      where: { status: LprSubmissionStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { submittedBy: { select: { id: true, displayName: true } } },
    });
    return submissions.map((s) => ({ ...this.toDto(s), submittedBy: s.submittedBy }));
  }

  async getPhoto(id: string) {
    const submission = await this.prisma.lprSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Заявка не найдена');
    const ciphertext = await this.storage.get(submission.storageKey);
    const buffer = decryptMedia(ciphertext, this.encryptionKey, submission.iv, submission.authTag);
    return { buffer, mimeType: submission.mimeType };
  }

  async review(id: string, decision: 'CONFIRMED' | 'REJECTED', reviewerUserId: string) {
    const submission = await this.prisma.lprSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Заявка не найдена');
    if (submission.status !== LprSubmissionStatus.PENDING) {
      throw new BadRequestException('Заявка уже рассмотрена');
    }

    if (decision === 'REJECTED') {
      const updated = await this.prisma.lprSubmission.update({
        where: { id },
        data: { status: LprSubmissionStatus.REJECTED, reviewedByUserId: reviewerUserId, reviewedAt: new Date() },
      });
      return this.toDto(updated);
    }

    const moduleDef = await this.prisma.moduleDefinition.findUnique({ where: { key: MODULE_KEY } });
    const points =
      (moduleDef?.config as { pointsPerRecognition?: number } | null)?.pointsPerRecognition ??
      DEFAULT_POINTS_PER_RECOGNITION;

    const updated = await this.prisma.$transaction(async (tx) => {
      const { statEvent } = await this.modulesRegistry.applyStatEventWithinTransaction(tx, {
        moduleKey: MODULE_KEY,
        userId: submission.submittedByUserId,
        points,
        reason: `Распознавание номера подтверждено модератором${submission.detectedPlate ? ` (${submission.detectedPlate})` : ''}`,
        occurredAt: new Date(),
        metadata: { submissionId: submission.id },
      });

      return tx.lprSubmission.update({
        where: { id },
        data: {
          status: LprSubmissionStatus.CONFIRMED,
          points,
          statEventId: statEvent.id,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
        },
      });
    });

    return this.toDto(updated);
  }

  private toDto(submission: {
    id: string;
    detectedPlate: string | null;
    confidence: number | null;
    status: LprSubmissionStatus;
    points: number | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }) {
    return {
      id: submission.id,
      detectedPlate: submission.detectedPlate,
      confidence: submission.confidence,
      status: submission.status,
      points: submission.points,
      createdAt: submission.createdAt,
      reviewedAt: submission.reviewedAt,
    };
  }
}
