import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class ConversationMessagesQueryDto {
  @Transform(toNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(toNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
