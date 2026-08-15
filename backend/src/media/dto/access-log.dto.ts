import { IsIn, IsOptional, IsObject } from 'class-validator';

export class ReportAccessEventDto {
  @IsIn(['DOWNLOAD_ATTEMPT', 'SCREENSHOT_DETECTED'])
  action!: 'DOWNLOAD_ATTEMPT' | 'SCREENSHOT_DETECTED';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
