import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { LprService } from './lpr.service';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 МБ — одно фото номера, не видео

@Controller('lpr')
export class LprController {
  constructor(private readonly lprService: LprService) {}

  // --- Участник ---

  @Post('submissions')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  submit(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.lprService.submit(user.userId, file);
  }

  @Get('submissions/mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.lprService.listMine(user.userId);
  }

  // --- Модерация (modules.manage) ---

  @Get('submissions/pending')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  listPending() {
    return this.lprService.listPending();
  }

  @Get('submissions/:id/photo')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.lprService.getPhoto(id);
    res.setHeader('Cache-Control', 'no-store');
    res.contentType(mimeType);
    res.send(buffer);
  }

  @Post('submissions/:id/review')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  review(@Param('id') id: string, @Body() dto: ReviewSubmissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lprService.review(id, dto.decision, user.userId);
  }
}
