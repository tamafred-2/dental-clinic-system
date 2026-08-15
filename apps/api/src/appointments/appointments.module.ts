import { Module } from '@nestjs/common';
import { AdminAppointmentsService } from './admin-appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AdminAppointmentsService],
})
export class AppointmentsModule {}
