import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  openingHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  appointmentPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  cancellationPolicy?: string;
}
