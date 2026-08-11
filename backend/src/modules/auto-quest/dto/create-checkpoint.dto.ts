import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCheckpointDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsInt()
  order?: number;
}
