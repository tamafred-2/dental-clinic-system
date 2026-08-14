import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';

const publicClinicSelection = {
  id: true,
  slug: true,
  name: true,
  address: true,
  phone: true,
  email: true,
  timeZone: true,
  openingHours: true,
  appointmentPolicy: true,
  cancellationPolicy: true,
} as const;

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic() {
    const clinic = await this.prisma.clinic.findFirst({
      orderBy: { createdAt: 'asc' },
      select: publicClinicSelection,
    });

    if (!clinic) {
      throw new NotFoundException(
        'Clinic information has not been configured.',
      );
    }

    return clinic;
  }

  async update(dto: UpdateClinicDto) {
    const clinic = await this.prisma.clinic.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!clinic) {
      throw new NotFoundException(
        'Clinic information has not been configured.',
      );
    }

    return this.prisma.clinic.update({
      where: { id: clinic.id },
      data: dto,
      select: publicClinicSelection,
    });
  }
}
