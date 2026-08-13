import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReportMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
