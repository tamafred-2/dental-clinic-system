import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, DayOfWeek } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

const dayByIndex: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];
const slotIntervalMinutes = 30;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async findSlots(query: AvailabilityQueryDto) {
    const dateParts = this.parseDate(query.date);
    const day =
      dayByIndex[
        new Date(
          Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day),
        ).getUTCDay()
      ];
    const { start, end } = this.utcSearchRange(dateParts);

    const [dentist, service, clinic] = await Promise.all([
      this.prisma.dentist.findUnique({
        where: { id: query.dentistId },
        include: { schedules: { where: { day } } },
      }),
      this.prisma.service.findUnique({ where: { id: query.serviceId } }),
      this.prisma.clinic.findFirst({
        include: {
          hours: { where: { day } },
          blockedDates: { where: { date: query.date } },
        },
      }),
    ]);

    if (!dentist || !dentist.active) {
      throw new NotFoundException('Active dentist not found.');
    }
    if (!service || !service.active) {
      throw new NotFoundException('Active service not found.');
    }
    if (!clinic) {
      throw new NotFoundException('Clinic configuration not found.');
    }
    if (clinic.blockedDates.length > 0) {
      return { date: query.date, timeZone: clinic.timeZone, slots: [] };
    }

    const dentistSchedule = dentist.schedules[0];
    const clinicHour = clinic.hours[0];
    if (!dentistSchedule || !clinicHour) {
      return { date: query.date, timeZone: clinic.timeZone, slots: [] };
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        dentistId: dentist.id,
        status: { not: AppointmentStatus.CANCELLED },
        scheduledAt: { lt: end },
        endAt: { gt: start },
      },
      select: { scheduledAt: true, endAt: true },
    });

    const startMinute = Math.max(
      this.toMinutes(dentistSchedule.startTime),
      this.toMinutes(clinicHour.startTime),
    );
    const endMinute = Math.min(
      this.toMinutes(dentistSchedule.endTime),
      this.toMinutes(clinicHour.endTime),
    );
    const slots = [];

    for (
      let minute = startMinute;
      minute + service.durationMinutes <= endMinute;
      minute += slotIntervalMinutes
    ) {
      const candidate = this.findInstantForLocalTime(
        query.date,
        minute,
        clinic.timeZone,
        start,
        end,
      );
      if (!candidate || candidate <= new Date()) {
        continue;
      }

      const candidateEnd = new Date(
        candidate.getTime() + service.durationMinutes * 60_000,
      );
      const overlaps = appointments.some(
        (appointment) =>
          appointment.scheduledAt < candidateEnd &&
          appointment.endAt > candidate,
      );

      if (!overlaps) {
        slots.push({
          time: this.formatTime(minute),
          scheduledAt: candidate.toISOString(),
          endAt: candidateEnd.toISOString(),
        });
      }
    }

    return { date: query.date, timeZone: clinic.timeZone, slots };
  }

  private parseDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('date must be a valid calendar date.');
    }
    return { year, month, day };
  }

  private utcSearchRange(date: { year: number; month: number; day: number }) {
    const midnightUtc = Date.UTC(date.year, date.month - 1, date.day);
    return {
      start: new Date(midnightUtc - 14 * 60 * 60 * 1000),
      end: new Date(midnightUtc + 38 * 60 * 60 * 1000),
    };
  }

  private findInstantForLocalTime(
    date: string,
    minute: number,
    timeZone: string,
    start: Date,
    end: Date,
  ) {
    for (
      let timestamp = start.getTime();
      timestamp < end.getTime();
      timestamp += slotIntervalMinutes * 60_000
    ) {
      const candidate = new Date(timestamp);
      const local = this.localParts(candidate, timeZone);
      if (local.date === date && local.minutes === minute) {
        return candidate;
      }
    }
    return undefined;
  }

  private localParts(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      minutes: Number(values.hour) * 60 + Number(values.minute),
    };
  }

  private toMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
      minutes % 60,
    ).padStart(2, '0')}`;
  }
}
