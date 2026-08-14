import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class AvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  dentistId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  serviceId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
