import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.service.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
      },
    });
  }
}
