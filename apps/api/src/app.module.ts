import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClinicModule } from './clinic/clinic.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DentistsModule } from './dentists/dentists.module';
import { FaqModule } from './faq/faq.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MessagesModule } from './messages/messages.module';
import { MessengerModule } from './messenger/messenger.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PatientsModule } from './patients/patients.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ServicesModule } from './services/services.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    DentistsModule,
    ServicesModule,
    AppointmentsModule,
    SchedulesModule,
    ClinicModule,
    FaqModule,
    KnowledgeModule,
    ConversationsModule,
    MessagesModule,
    AiModule,
    MessengerModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
