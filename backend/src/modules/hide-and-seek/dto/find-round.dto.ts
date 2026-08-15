import { IsString, MinLength } from 'class-validator';

export class FindRoundDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
