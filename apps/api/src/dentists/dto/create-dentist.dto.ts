import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateDentistDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(5_000)
  bio!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  specializations!: string[];

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2_048)
  photoUrl?: string;
}
