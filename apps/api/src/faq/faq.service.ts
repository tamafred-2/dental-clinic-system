import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.faq.findMany({
      where: { published: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        question: true,
        answer: true,
      },
    });
  }
}
