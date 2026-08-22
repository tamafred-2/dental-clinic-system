import { Transform } from 'class-transformer';
import { ConversationChannel, ConversationStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum ConversationAssignmentFilter {
  ALL = 'ALL',
  MINE = 'MINE',
  UNASSIGNED = 'UNASSIGNED',
}

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class ConversationQueryDto {
  @IsOptional()
  @IsEnum(ConversationChannel)
  channel?: ConversationChannel;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsEnum(ConversationAssignmentFilter)
  assignment = ConversationAssignmentFilter.ALL;

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
  limit = 25;
}
