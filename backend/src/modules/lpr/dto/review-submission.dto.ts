import { IsIn } from 'class-validator';

export class ReviewSubmissionDto {
  @IsIn(['CONFIRMED', 'REJECTED'])
  decision!: 'CONFIRMED' | 'REJECTED';
}
