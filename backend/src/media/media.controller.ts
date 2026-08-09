import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { MediaService } from './media.service';
import { ReportAccessEventDto } from './dto/access-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 МБ — достаточно для фото/коротких видео на этом этапе

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.mediaService.upload(user.userId, file);
  }

  @Get(':id/token')
  @UseGuards(JwtAuthGuard)
  issueToken(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.issueAccessToken(id, user.userId);
  }

  // Без JwtAuthGuard намеренно: запрос идёт напрямую из <Image>/видеоплеера,
  // которые не всегда прикладывают Authorization-заголовок. Доступ
  // контролируется самим короткоживущим токеном (см. MediaService).
  @Get(':id/content')
  async getContent(@Param('id') id: string, @Query('token') token: string, @Res() res: Response) {
    if (!token) throw new BadRequestException('Токен доступа обязателен');
    const { buffer, mimeType } = await this.mediaService.getContent(id, token);
    res.setHeader('Cache-Control', 'no-store');
    res.contentType(mimeType);
    res.send(buffer);
  }

  @Post(':id/access-log')
  @UseGuards(JwtAuthGuard)
  reportAccessEvent(
    @Param('id') id: string,
    @Body() dto: ReportAccessEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.logAccessEvent(id, user.userId, dto.action, dto.metadata);
  }
}
