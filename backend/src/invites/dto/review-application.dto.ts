import { IsIn } from 'class-validator';

export class ReviewApplicationDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}
