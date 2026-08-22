import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAppointmentsService } from './admin-appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AdminAppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
