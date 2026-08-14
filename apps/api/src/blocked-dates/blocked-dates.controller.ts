import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { BlockedDatesService } from './blocked-dates.service';
import { CreateBlockedDateDto } from './dto/create-blocked-date.dto';

@Controller('blocked-dates')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BlockedDatesController {
  constructor(private readonly blockedDatesService: BlockedDatesService) {}

  @Get()
  findAll() {
    return this.blockedDatesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateBlockedDateDto) {
    return this.blockedDatesService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blockedDatesService.remove(id);
  }
}
