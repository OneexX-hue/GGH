import { IsDateString } from 'class-validator';

export class ExpireAtDto {
  @IsDateString()
  expiresAt!: string;
}
