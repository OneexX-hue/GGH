import { IsString, MinLength } from 'class-validator';

export class RedeemCheckpointDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
