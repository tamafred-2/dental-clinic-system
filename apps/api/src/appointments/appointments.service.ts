import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppointmentStatus, DayOfWeek, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { NotificationsService } from '../notifications/notifications.service';

const dayByName: Record<string, DayOfWeek> = {
  Sunday: DayOfWeek.SUNDAY,
  Monday: DayOfWeek.MONDAY,
  Tuesday: DayOfWeek.TUESDAY,
  Wednesday: DayOfWeek.WEDNESDAY,
  Thursday: DayOfWeek.THURSDAY,
  Friday: DayOfWeek.FRIDAY,
  Saturday: DayOfWeek.SATURDAY,
};

const slotIntervalMinutes = 30;
const maximumAdvanceDays = 180;
const maximumFuturePendingAppointments = 3;
const appointmentResultSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  endAt: true,
  dentist: { select: { name: true, title: true } },
  service: { select: { name: true, durationMinutes: true } },
} as const;

export type AppointmentCreationContext = {
  appointmentIntentId?: string;
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    context: AppointmentCreationContext = {},
  ) {
    if (dto.website) {
      throw new BadRequestException('Unable to process appointment request.');
    }

    if (context.appointmentIntentId) {
      const existing = await this.prisma.appointment.findUnique({
        where: { appointmentIntentId: context.appointmentIntentId },
        select: appointmentResultSelect,
      });
      if (existing) return existing;
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const now = new Date();
    const latestAllowedDate = new Date(
      now.getTime() + maximumAdvanceDays * 24 * 60 * 60 * 1000,
    );

    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
      throw new BadRequestException(
        'scheduledAt must be a future date and time.',
      );
    }
    if (scheduledAt > latestAllowedDate) {
      throw new BadRequestException(
        `Appointments can only be requested up to ${maximumAdvanceDays} days ahead.`,
      );
    }

    try {
      const appointment = await this.prisma.$transaction(
        async (transaction) => {
          const clinic = await transaction.clinic.findFirst({
            select: { id: true, timeZone: true },
          });

          if (!clinic) {
            throw new ServiceUnavailableException(
              'Clinic scheduling configuration is unavailable.',
            );
          }

          const localStart = this.getLocalTime(scheduledAt, clinic.timeZone);
          const [dentist, service, clinicRules] = await Promise.all([
            transaction.dentist.findUnique({
              where: { id: dto.dentistId },
              include: { schedules: { where: { day: localStart.day } } },
            }),
            transaction.service.findUnique({
              where: { id: dto.serviceId },
            }),
            transaction.clinic.findUnique({
              where: { id: clinic.id },
              include: {
                hours: { where: { day: localStart.day } },
                blockedDates: { where: { date: localStart.date } },
              },
            }),
          ]);

          if (!dentist) {
            throw new NotFoundException('Dentist not found.');
          }
          if (!service) {
            throw new NotFoundException('Service not found.');
          }
          if (!clinicRules) {
            throw new ServiceUnavailableException(
              'Clinic scheduling configuration is unavailable.',
            );
          }
          if (!dentist.active) {
            throw new BadRequestException('Dentist is not active.');
          }
          if (!service.active) {
            throw new BadRequestException('Service is not active.');
          }

          const dentistSchedule = dentist.schedules[0];
          const clinicHours = clinicRules.hours[0];

          if (
            !dentistSchedule ||
            !clinicHours ||
            clinicRules.blockedDates.length > 0
          ) {
            this.throwSlotUnavailable();
          }

          const endAt = new Date(
            scheduledAt.getTime() + service.durationMinutes * 60_000,
          );
          const localEnd = this.getLocalTime(endAt, clinic.timeZone);
          const availableStart = Math.max(
            this.toMinutes(dentistSchedule.startTime),
            this.toMinutes(clinicHours.startTime),
          );
          const availableEnd = Math.min(
            this.toMinutes(dentistSchedule.endTime),
            this.toMinutes(clinicHours.endTime),
          );
          const startsOnSlotBoundary =
            (localStart.minutes - availableStart) % slotIntervalMinutes === 0;

          if (
            localEnd.date !== localStart.date ||
            localStart.minutes < availableStart ||
            localEnd.minutes > availableEnd ||
            !startsOnSlotBoundary
          ) {
            this.throwSlotUnavailable();
          }

          const overlappingAppointment =
            await transaction.appointment.findFirst({
              where: {
                dentistId: dentist.id,
                status: { not: AppointmentStatus.CANCELLED },
                scheduledAt: { lt: endAt },
                endAt: { gt: scheduledAt },
              },
              select: { id: true },
            });

          if (overlappingAppointment) {
            this.throwSlotUnavailable();
          }

          const existingPatient = await transaction.patient.findUnique({
            where: { email: dto.email },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          });
          let patient: { id: string };

          if (existingPatient) {
            const detailsMatch =
              this.normalizeName(existingPatient.firstName) ===
                this.normalizeName(dto.firstName) &&
              this.normalizeName(existingPatient.lastName) ===
                this.normalizeName(dto.lastName) &&
              this.normalizePhone(existingPatient.phone) ===
                this.normalizePhone(dto.phone);

            if (!detailsMatch) {
              this.throwContactVerificationRequired();
            }
            patient = { id: existingPatient.id };
          } else {
            try {
              patient = await transaction.patient.create({
                data: {
                  firstName: dto.firstName,
                  lastName: dto.lastName,
                  email: dto.email,
                  phone: dto.phone,
                },
                select: { id: true },
              });
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
              ) {
                this.throwContactVerificationRequired();
              }
              throw error;
            }
          }

          const [patientScheduleConflict, futurePendingCount] =
            await Promise.all([
              transaction.appointment.findFirst({
                where: {
                  patientId: patient.id,
                  status: { not: AppointmentStatus.CANCELLED },
                  scheduledAt: { lt: endAt },
                  endAt: { gt: scheduledAt },
                },
                select: { id: true },
              }),
              transaction.appointment.count({
                where: {
                  patientId: patient.id,
                  status: AppointmentStatus.PENDING,
                  scheduledAt: { gte: now },
                },
              }),
            ]);

          if (patientScheduleConflict) {
            this.throwSlotUnavailable();
          }
          if (futurePendingCount >= maximumFuturePendingAppointments) {
            throw new ConflictException({
              message:
                'This patient already has several pending appointment requests. Please contact the clinic for assistance.',
              code: 'APPOINTMENT_PENDING_LIMIT_REACHED',
            });
          }

          return transaction.appointment.create({
            data: {
              patientId: patient.id,
              dentistId: dentist.id,
              serviceId: service.id,
              scheduledAt,
              endAt,
              status: AppointmentStatus.PENDING,
              privacyConsentAt: now,
              appointmentIntentId: context.appointmentIntentId,
            },
            select: appointmentResultSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (this.notifications) {
        const clinic = await this.prisma.clinic.findFirst({
          orderBy: { createdAt: 'asc' },
          select: {
            name: true,
            address: true,
            phone: true,
            email: true,
            timeZone: true,
            cancellationPolicy: true,
            appointmentPolicy: true,
          },
        });
        if (!clinic) {
          // The appointment is already committed. Notification enrichment is
          // best-effort and must never turn a successful create into an error.
          this.logger.warn(
            `Skipping appointment notification for ${appointment.id}: clinic metadata unavailable.`,
          );
        } else {
          await this.notifications.publishAppointmentCreated({
            id: `appointment.created:${appointment.id}`,
            type: 'appointment.created',
            occurredAt: new Date().toISOString(),
            appointment: {
              ...appointment,
              patient: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                email: dto.email,
                phone: dto.phone,
              },
              clinic,
            },
          });
        }
      }
      return appointment;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        if (error.code === 'P2002' && context.appointmentIntentId) {
          const existing = await this.prisma.appointment.findUnique({
            where: { appointmentIntentId: context.appointmentIntentId },
            select: appointmentResultSelect,
          });
          if (existing) return existing;
        }
        this.throwSlotUnavailable();
      }
      throw error;
    }
  }

  private throwSlotUnavailable(): never {
    throw new ConflictException({
      message: 'Selected appointment time is no longer available.',
      code: 'APPOINTMENT_SLOT_UNAVAILABLE',
    });
  }

  private throwContactVerificationRequired(): never {
    throw new ConflictException({
      message:
        'The contact details could not be verified. Please contact the clinic for assistance.',
      code: 'APPOINTMENT_CONTACT_VERIFICATION_REQUIRED',
    });
  }

  private normalizeName(value: string) {
    return value.trim().toLocaleLowerCase('en');
  }

  private normalizePhone(value: string) {
    return value.replace(/\D/g, '');
  }

  private toMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getLocalTime(date: Date, timeZone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      const values = Object.fromEntries(
        parts
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, part.value]),
      );
      const day = dayByName[values.weekday];

      if (
        !day ||
        values.year === undefined ||
        values.month === undefined ||
        values.day === undefined ||
        values.hour === undefined ||
        values.minute === undefined
      ) {
        throw new Error('Missing clinic time components.');
      }

      return {
        day,
        date: `${values.year}-${values.month}-${values.day}`,
        minutes: Number(values.hour) * 60 + Number(values.minute),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Clinic timezone configuration is invalid.',
      );
    }
  }
}
