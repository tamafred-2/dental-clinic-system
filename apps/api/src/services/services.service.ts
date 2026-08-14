import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const publicServiceSelection = {
  id: true,
  name: true,
  description: true,
  durationMinutes: true,
} as const;

const adminServiceSelection = {
  ...publicServiceSelection,
  active: true,
  displayOrder: true,
} as const;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.service.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: publicServiceSelection,
    });
  }

  findAllForAdmin() {
    return this.prisma.service.findMany({
      orderBy: { displayOrder: 'asc' },
      select: adminServiceSelection,
    });
  }

  async create(dto: CreateServiceDto) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const maxDisplayOrder = await this.getMaxDisplayOrder(transaction);
          const displayOrder = dto.displayOrder ?? maxDisplayOrder + 1;

          if (displayOrder > maxDisplayOrder + 1) {
            throw new BadRequestException(
              `displayOrder must be between 1 and ${maxDisplayOrder + 1}.`,
            );
          }

          const servicesToShift = await transaction.service.findMany({
            where: { displayOrder: { gte: displayOrder } },
            orderBy: { displayOrder: 'desc' },
            select: { id: true, displayOrder: true },
          });

          for (const service of servicesToShift) {
            await transaction.service.update({
              where: { id: service.id },
              data: { displayOrder: service.displayOrder + 1 },
            });
          }

          return transaction.service.create({
            data: {
              name: dto.name.trim(),
              description: dto.description.trim(),
              durationMinutes: dto.durationMinutes,
              displayOrder,
            },
            select: adminServiceSelection,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwServiceConflict(error);
    }
  }

  async update(id: string, dto: UpdateServiceDto) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.service.findUnique({
            where: { id },
            select: { id: true, displayOrder: true },
          });

          if (!existing) {
            throw new NotFoundException('Service not found.');
          }

          const displayOrder = dto.displayOrder ?? existing.displayOrder;
          const maxDisplayOrder = await this.getMaxDisplayOrder(transaction);

          if (displayOrder > maxDisplayOrder) {
            throw new BadRequestException(
              `displayOrder must be between 1 and ${maxDisplayOrder}.`,
            );
          }

          if (displayOrder !== existing.displayOrder) {
            await transaction.service.update({
              where: { id },
              data: { displayOrder: maxDisplayOrder + 1 },
            });

            const servicesToShift = await transaction.service.findMany({
              where:
                displayOrder < existing.displayOrder
                  ? {
                      displayOrder: {
                        gte: displayOrder,
                        lt: existing.displayOrder,
                      },
                    }
                  : {
                      displayOrder: {
                        gt: existing.displayOrder,
                        lte: displayOrder,
                      },
                    },
              orderBy: {
                displayOrder:
                  displayOrder < existing.displayOrder ? 'desc' : 'asc',
              },
              select: { id: true, displayOrder: true },
            });

            for (const service of servicesToShift) {
              await transaction.service.update({
                where: { id: service.id },
                data: {
                  displayOrder:
                    displayOrder < existing.displayOrder
                      ? service.displayOrder + 1
                      : service.displayOrder - 1,
                },
              });
            }
          }

          return transaction.service.update({
            where: { id },
            data: {
              ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
              ...(dto.description !== undefined
                ? { description: dto.description.trim() }
                : {}),
              ...(dto.durationMinutes !== undefined
                ? { durationMinutes: dto.durationMinutes }
                : {}),
              ...(dto.active !== undefined ? { active: dto.active } : {}),
              displayOrder,
            },
            select: adminServiceSelection,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwServiceConflict(error);
    }
  }

  private async getMaxDisplayOrder(transaction: Prisma.TransactionClient) {
    const aggregate = await transaction.service.aggregate({
      _max: { displayOrder: true },
    });
    return aggregate._max.displayOrder ?? 0;
  }

  private throwServiceConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A service with that name already exists.');
    }

    throw error;
  }
}
