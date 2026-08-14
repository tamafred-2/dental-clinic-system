import { Transform } from 'class-transformer';
import {
  Equals,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAppointmentDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9][0-9 ()-]{6,24}$/, {
    message: 'phone must be a valid contact number.',
  })
  phone!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  dentistId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  serviceId!: string;

  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'scheduledAt must include a UTC or numeric timezone offset.',
  })
  scheduledAt!: string;

  @Equals(true, {
    message: 'privacyConsent must be accepted.',
  })
  privacyConsent!: boolean;
}
