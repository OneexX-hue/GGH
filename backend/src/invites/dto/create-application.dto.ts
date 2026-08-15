import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @MinLength(2)
  applicantName!: string;

  @IsString()
  contact!: string; // email или телефон

  @IsOptional()
  @IsString()
  inviteId?: string; // если заявка подана в контексте существующего инвайта-приглашения к вступлению
}
