import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier!: string; // email или телефон

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  totpCode?: string; // обязателен, если у пользователя включена 2FA
}
