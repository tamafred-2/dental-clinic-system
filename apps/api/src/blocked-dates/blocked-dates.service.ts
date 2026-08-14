import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockedDateDto } from './dto/create-blocked-date.dto';

@Injectable()
export class BlockedDatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const clinic = await this.getClinic();
    return this.prisma.blockedDate.findMany({
      where: { clinicId: clinic.id },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, reason: true, createdAt: true },
    });
  }

  async create(dto: CreateBlockedDateDto) {
    const clinic = await this.getClinic();
    this.validateDate(dto.date);

    if (dto.date < this.currentDateInTimeZone(clinic.timeZone)) {
      throw new BadRequestException('Blocked dates cannot be in the past.');
    }

    try {
      return await this.prisma.blockedDate.create({
        data: {
          clinicId: clinic.id,
          date: dto.date,
          reason: dto.reason?.trim(),
        },
        select: { id: true, date: true, reason: true, createdAt: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This clinic date is already blocked.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const clinic = await this.getClinic();
    const result = await this.prisma.blockedDate.deleteMany({
      where: { id, clinicId: clinic.id },
    });

    if (result.count === 0) {
      throw new NotFoundException('Blocked date not found.');
    }

    return { status: 'ok' };
  }

  private async getClinic() {
    const clinic = await this.prisma.clinic.findFirst({
      select: { id: true, timeZone: true },
    });
    if (!clinic) {
      throw new NotFoundException('Clinic configuration not found.');
    }
    return clinic;
  }

  private validateDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('date must be a valid calendar date.');
    }
  }

  private currentDateInTimeZone(timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }
}
