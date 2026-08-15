import { IsDateString, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'scheduledAt must include a UTC or numeric timezone offset.',
  })
  scheduledAt!: string;
}
