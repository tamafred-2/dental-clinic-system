import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateBlockedDateDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
