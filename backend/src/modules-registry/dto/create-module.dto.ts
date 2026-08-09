import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @MinLength(2)
  key!: string; // например "auto-quest"

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
