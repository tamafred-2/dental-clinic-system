import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  patientId!: string;

  @IsString()
  dentistId!: string;

  @IsString()
  serviceId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
