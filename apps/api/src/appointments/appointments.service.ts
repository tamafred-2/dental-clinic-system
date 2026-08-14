import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DayOfWeek, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

const dayByIndex: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto) {
    const scheduledAt = new Date(dto.scheduledAt);

    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new BadRequestException(
        'scheduledAt must be a future date and time.',
      );
    }

    const [patient, dentist, service] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId } }),
      this.prisma.dentist.findUnique({
        where: { id: dto.dentistId },
        include: { schedules: true },
      }),
      this.prisma.service.findUnique({ where: { id: dto.serviceId } }),
    ]);

    if (!patient) {
      throw new NotFoundException('Patient not found.');
    }

    if (!dentist) {
      throw new NotFoundException('Dentist not found.');
    }

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    if (!dentist.active) {
      throw new BadRequestException('Dentist is not active.');
    }

    if (!service.active) {
      throw new BadRequestException('Service is not active.');
    }

    const endAt = new Date(
      scheduledAt.getTime() + service.durationMinutes * 60_000,
    );
    const day = dayByIndex[scheduledAt.getUTCDay()];
    const schedule = dentist.schedules.find((item) => item.day === day);

    if (!schedule) {
      throw new BadRequestException(
        'Dentist does not work at the requested time.',
      );
    }

    const appointmentStart = this.toMinutes(scheduledAt);
    const appointmentEnd = this.toMinutes(endAt);
    const scheduleStart = this.toMinutes(schedule.startTime);
    const scheduleEnd = this.toMinutes(schedule.endTime);
    const clinicStart = 9 * 60;
    const clinicEnd = 18 * 60;

    if (
      appointmentStart < scheduleStart ||
      appointmentEnd > scheduleEnd ||
      appointmentStart < clinicStart ||
      appointmentEnd > clinicEnd
    ) {
      throw new BadRequestException(
        'The requested appointment is outside dentist or clinic hours.',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const overlappingAppointment =
            await transaction.appointment.findFirst({
              where: {
                dentistId: dentist.id,
                status: { notIn: ['CANCELLED'] },
                scheduledAt: { lt: endAt },
                endAt: { gt: scheduledAt },
              },
            });

          if (overlappingAppointment) {
            throw new ConflictException(
              'The dentist is no longer available at that time.',
            );
          }

          return transaction.appointment.create({
            data: {
              patientId: patient.id,
              dentistId: dentist.id,
              serviceId: service.id,
              scheduledAt,
              endAt,
              notes: dto.notes,
            },
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              endAt: true,
              patient: {
                select: { id: true, firstName: true, lastName: true },
              },
              dentist: { select: { id: true, name: true, title: true } },
              service: {
                select: { id: true, name: true, durationMinutes: true },
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'The dentist is no longer available at that time.',
        );
      }

      throw error;
    }
  }

  private toMinutes(value: Date | string) {
    if (value instanceof Date) {
      return value.getUTCHours() * 60 + value.getUTCMinutes();
    }

    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
