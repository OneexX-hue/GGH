import { IsString, MinLength } from 'class-validator';

export class MuteSenderDto {
  @IsString()
  @MinLength(1)
  username!: string;
}
