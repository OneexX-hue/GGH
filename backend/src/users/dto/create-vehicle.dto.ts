import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  make!: string;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsString()
  @MinLength(2)
  plateNumber!: string;

  @IsOptional()
  @IsBoolean()
  isPlatePublic?: boolean;
}
