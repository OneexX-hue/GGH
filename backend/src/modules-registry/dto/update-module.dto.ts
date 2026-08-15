import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateModuleDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
