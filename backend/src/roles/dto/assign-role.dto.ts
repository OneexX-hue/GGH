import { IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  userId!: string;
}
