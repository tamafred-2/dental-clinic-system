import { Module } from '@nestjs/common';
import { BlockedDatesController } from './blocked-dates.controller';
import { BlockedDatesService } from './blocked-dates.service';

@Module({
  controllers: [BlockedDatesController],
  providers: [BlockedDatesService],
})
export class BlockedDatesModule {}
