import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ConversationStatus,
  DayOfWeek,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAppointmentsQueryDto } from './dto/admin-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

const maximumAdvanceDays = 180;
const slotIntervalMinutes = 30;
const maximumListRangeDays = 366;

const dayByName: Record<string, DayOfWeek> = {
  Sunday: DayOfWeek.SUNDAY,
  Monday: DayOfWeek.MONDAY,
  Tuesday: DayOfWeek.TUESDAY,
  Wednesday: DayOfWeek.WEDNESDAY,
  Thursday: DayOfWeek.THURSDAY,
  Friday: DayOfWeek.FRIDAY,
  Saturday: DayOfWeek.SATURDAY,
};

const appointmentListSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  endAt: true,
  createdAt: true,
  patient: {
    select: { id: true, firstName: true, lastName: true },
  },
  dentist: {
    select: { id: true, name: true, title: true },
  },
  service: {
    select: { id: true, name: true, durationMinutes: true },
  },
} satisfies Prisma.AppointmentSelect;

const appointmentDetailSelect = {
  ...appointmentListSelect,
  updatedAt: true,
  notes: true,
  cancellationReason: true,
  privacyConsentAt: true,
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
} satisfies Prisma.AppointmentSelect;

const allowedStatusTransitions: Record<AppointmentStatus, AppointmentStatus[]> =
  {
    [AppointmentStatus.PENDING]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ],
    [AppointmentStatus.RESCHEDULED]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.COMPLETED]: [],
    [AppointmentStatus.CANCELLED]: [],
    [AppointmentStatus.NO_SHOW]: [],
  };

const finalAppointmentStatuses = new Set<AppointmentStatus>([
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

@Injectable()
export class AdminAppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const clinic = await this.prisma.clinic.findFirst({
      select: { timeZone: true },
    });
    if (!clinic) {
      throw new ServiceUnavailableException(
        'Clinic scheduling configuration is unavailable.',
      );
    }

    const now = new Date();
    const localDate = this.getLocalTime(now, clinic.timeZone).date;
    const todayStart = this.localMidnight(localDate, clinic.timeZone);
    const tomorrowStart = this.localMidnight(
      this.addCalendarDays(localDate, 1),
      clinic.timeZone,
    );
    const activeUpcomingStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.RESCHEDULED,
    ];

    const [
      todayAppointments,
      pendingRequests,
      confirmedAppointments,
      cancelledAppointments,
      noShowAppointments,
      upcomingAppointments,
      aiConversations,
      humanHandoffs,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: { scheduledAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.appointment.count({
        where: { status: AppointmentStatus.PENDING },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.CONFIRMED,
          scheduledAt: { gte: now },
        },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.CANCELLED,
          scheduledAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.NO_SHOW,
          scheduledAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      this.prisma.appointment.count({
        where: {
          status: { in: activeUpcomingStatuses },
          scheduledAt: { gte: now },
        },
      }),
      this.prisma.conversation.count({
        where: { status: ConversationStatus.AI_ACTIVE },
      }),
      this.prisma.conversation.count({
        where: { status: ConversationStatus.HUMAN_REQUIRED },
      }),
    ]);

    return {
      generatedAt: now,
      timeZone: clinic.timeZone,
      today: localDate,
      statistics: {
        todayAppointments,
        pendingRequests,
        confirmedAppointments,
        cancelledAppointments,
        noShowAppointments,
        upcomingAppointments,
        aiConversations,
        humanHandoffs,
      },
    };
  }

  async findAll(query: AdminAppointmentsQueryDto) {
    const clinic = await this.prisma.clinic.findFirst({
      select: { timeZone: true },
    });
    if (!clinic) {
      throw new ServiceUnavailableException(
        'Clinic scheduling configuration is unavailable.',
      );
    }

    const today = this.getLocalTime(new Date(), clinic.timeZone).date;
    const fromDate = query.from ?? today;
    const toDate = query.to ?? this.addCalendarDays(fromDate, 30);
    const from = this.localMidnight(fromDate, clinic.timeZone);
    const until = this.localMidnight(
      this.addCalendarDays(toDate, 1),
      clinic.timeZone,
    );

    if (from >= until) {
      throw new BadRequestException('from must be on or before to.');
    }
    if (until.getTime() - from.getTime() > maximumListRangeDays * 86_400_000) {
      throw new BadRequestException(
        `Appointment searches cannot exceed ${maximumListRangeDays} days.`,
      );
    }

    const where: Prisma.AppointmentWhereInput = {
      scheduledAt: { gte: from, lt: until },
      ...(query.dentistId ? { dentistId: query.dentistId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: appointmentListSelect,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: { from: fromDate, to: toDate },
      timeZone: clinic.timeZone,
    };
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: appointmentDetailSelect,
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }
    return appointment;
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    return this.prisma.$transaction(async (transaction) => {
      const appointment = await transaction.appointment.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found.');
      }
      if (!allowedStatusTransitions[appointment.status].includes(dto.status)) {
        throw new ConflictException(
          `Appointment cannot change from ${appointment.status} to ${dto.status}.`,
        );
      }
      if (
        dto.status === AppointmentStatus.CANCELLED &&
        !dto.cancellationReason
      ) {
        throw new BadRequestException(
          'cancellationReason is required when cancelling an appointment.',
        );
      }
      if (
        dto.status !== AppointmentStatus.CANCELLED &&
        dto.cancellationReason
      ) {
        throw new BadRequestException(
          'cancellationReason is only accepted when cancelling an appointment.',
        );
      }

      const result = await transaction.appointment.updateMany({
        where: { id, status: appointment.status },
        data: {
          status: dto.status,
          cancellationReason:
            dto.status === AppointmentStatus.CANCELLED
              ? dto.cancellationReason
              : null,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Appointment changed while this request was being processed. Refresh and try again.',
        );
      }

      return transaction.appointment.findUniqueOrThrow({
        where: { id },
        select: appointmentDetailSelect,
      });
    });
  }

  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    const now = new Date();
    const latestAllowedDate = new Date(
      now.getTime() + maximumAdvanceDays * 86_400_000,
    );
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
      throw new BadRequestException(
        'scheduledAt must be a future date and time.',
      );
    }
    if (scheduledAt > latestAllowedDate) {
      throw new BadRequestException(
        `Appointments can only be scheduled up to ${maximumAdvanceDays} days ahead.`,
      );
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const appointment = await transaction.appointment.findUnique({
            where: { id },
            select: {
              id: true,
              status: true,
              patientId: true,
              dentistId: true,
              serviceId: true,
            },
          });
          if (!appointment) {
            throw new NotFoundException('Appointment not found.');
          }
          if (finalAppointmentStatuses.has(appointment.status)) {
            throw new ConflictException(
              `${appointment.status} appointments cannot be rescheduled.`,
            );
          }

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
              where: { id: appointment.dentistId },
              include: { schedules: { where: { day: localStart.day } } },
            }),
            transaction.service.findUnique({
              where: { id: appointment.serviceId },
            }),
            transaction.clinic.findUnique({
              where: { id: clinic.id },
              include: {
                hours: { where: { day: localStart.day } },
                blockedDates: { where: { date: localStart.date } },
              },
            }),
          ]);
          if (!dentist?.active || !service?.active || !clinicRules) {
            throw new ConflictException(
              'The selected schedule is unavailable.',
            );
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

          const [dentistConflict, patientConflict] = await Promise.all([
            transaction.appointment.findFirst({
              where: {
                id: { not: appointment.id },
                dentistId: appointment.dentistId,
                status: { not: AppointmentStatus.CANCELLED },
                scheduledAt: { lt: endAt },
                endAt: { gt: scheduledAt },
              },
              select: { id: true },
            }),
            transaction.appointment.findFirst({
              where: {
                id: { not: appointment.id },
                patientId: appointment.patientId,
                status: { not: AppointmentStatus.CANCELLED },
                scheduledAt: { lt: endAt },
                endAt: { gt: scheduledAt },
              },
              select: { id: true },
            }),
          ]);
          if (dentistConflict || patientConflict) {
            this.throwSlotUnavailable();
          }

          await transaction.appointment.update({
            where: { id: appointment.id },
            data: {
              scheduledAt,
              endAt,
              status: AppointmentStatus.RESCHEDULED,
              cancellationReason: null,
            },
          });
          return transaction.appointment.findUniqueOrThrow({
            where: { id: appointment.id },
            select: appointmentDetailSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
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
      if (!day) throw new Error('Invalid clinic weekday.');
      return {
        day,
        date: `${values.year}-${values.month}-${values.day}`,
        minutes: Number(values.hour) * 60 + Number(values.minute),
        year: Number(values.year),
        month: Number(values.month),
        dateNumber: Number(values.day),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Clinic timezone configuration is invalid.',
      );
    }
  }

  private localMidnight(date: string, timeZone: string) {
    const [year, month, day] = this.parseDate(date);
    const desired = Date.UTC(year, month - 1, day);
    let timestamp = desired;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const local = this.getLocalTime(new Date(timestamp), timeZone);
      const representedAsUtc = Date.UTC(
        local.year,
        local.month - 1,
        local.dateNumber,
        Math.floor(local.minutes / 60),
        local.minutes % 60,
      );
      const difference = desired - representedAsUtc;
      timestamp += difference;
      if (difference === 0) break;
    }

    const result = new Date(timestamp);
    const local = this.getLocalTime(result, timeZone);
    if (local.date !== date || local.minutes !== 0) {
      throw new ServiceUnavailableException(
        'Clinic timezone configuration is invalid.',
      );
    }
    return result;
  }

  private parseDate(value: string) {
    const parts = value.split('-').map(Number);
    const [year, month, day] = parts;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      parts.length !== 3 ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Date filters must be valid dates.');
    }
    return [year, month, day] as const;
  }

  private addCalendarDays(value: string, days: number) {
    const [year, month, day] = this.parseDate(value);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
}
