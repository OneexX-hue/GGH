import { IsString, MinLength } from 'class-validator';

export class BanSenderDto {
  @IsString()
  @MinLength(1)
  rocketChatUserId!: string;
}
