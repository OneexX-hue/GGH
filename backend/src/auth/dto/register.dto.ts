import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsString()
  inviteCode!: string;

  @ValidateIf((dto: RegisterDto) => !dto.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((dto: RegisterDto) => !dto.email)
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;
}
