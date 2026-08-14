import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  findSlots(@Query() query: AvailabilityQueryDto) {
    return this.availabilityService.findSlots(query);
  }
}
