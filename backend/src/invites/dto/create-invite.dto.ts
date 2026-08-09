import { InviteType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class CreateInviteDto {
  @IsEnum(InviteType)
  type!: InviteType;

  @ValidateIf((dto: CreateInviteDto) => dto.type === InviteType.MULTI_USE)
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ValidateIf((dto: CreateInviteDto) => dto.type === InviteType.PERSONAL)
  @IsString()
  personalContact?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
