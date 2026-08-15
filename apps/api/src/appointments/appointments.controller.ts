import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminAppointmentsService } from './admin-appointments.service';
import { AppointmentsService } from './appointments.service';
import { AdminAppointmentsQueryDto } from './dto/admin-appointments-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly adminAppointmentsService: AdminAppointmentsService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get('admin/overview')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  overview() {
    return this.adminAppointmentsService.overview();
  }

  @Get('admin')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAllForAdmin(@Query() query: AdminAppointmentsQueryDto) {
    return this.adminAppointmentsService.findAll(query);
  }

  @Get('admin/:id')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findOneForAdmin(@Param('id') id: string) {
    return this.adminAppointmentsService.findOne(id);
  }

  @Patch('admin/:id/status')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.adminAppointmentsService.updateStatus(id, dto);
  }

  @Patch('admin/:id/reschedule')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  reschedule(@Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.adminAppointmentsService.reschedule(id, dto);
  }
}
