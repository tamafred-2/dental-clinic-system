import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDentistDto } from './dto/create-dentist.dto';
import { UpdateDentistDto } from './dto/update-dentist.dto';

const dentistSelection = {
  id: true,
  name: true,
  title: true,
  bio: true,
  specializations: true,
  photoUrl: true,
  active: true,
} as const;

@Injectable()
export class DentistsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.dentist.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: dentistSelection,
    });
  }

  async findOnePublic(id: string) {
    const dentist = await this.prisma.dentist.findFirst({
      where: { id, active: true },
      select: dentistSelection,
    });

    if (!dentist) {
      throw new NotFoundException('Dentist not found.');
    }

    return dentist;
  }

  findAllForAdmin() {
    return this.prisma.dentist.findMany({
      orderBy: { name: 'asc' },
      select: dentistSelection,
    });
  }

  create(dto: CreateDentistDto) {
    return this.prisma.dentist.create({
      data: dto,
      select: dentistSelection,
    });
  }

  async update(id: string, dto: UpdateDentistDto) {
    await this.ensureExists(id);

    return this.prisma.dentist.update({
      where: { id },
      data: dto,
      select: dentistSelection,
    });
  }

  private async ensureExists(id: string) {
    const dentist = await this.prisma.dentist.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!dentist) {
      throw new NotFoundException('Dentist not found.');
    }
  }
}
