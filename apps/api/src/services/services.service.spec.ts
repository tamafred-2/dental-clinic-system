import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const transaction = {
    service: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    service: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ServicesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.service.aggregate.mockResolvedValue({
      _max: { displayOrder: 2 },
    });
    transaction.service.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
  });

  it('returns only active services for the public endpoint', async () => {
    prisma.service.findMany.mockResolvedValue([]);

    await service.findAllPublic();

    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
      },
    });
  });

  it('appends and normalizes a service when no order is supplied', async () => {
    transaction.service.create.mockResolvedValue({ id: 'service-3' });

    await service.create({
      name: '  Dental Cleaning  ',
      description: '  Professional cleaning.  ',
      durationMinutes: 45,
    });

    expect(transaction.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Dental Cleaning',
          description: 'Professional cleaning.',
          durationMinutes: 45,
          displayOrder: 3,
        },
      }),
    );
  });

  it('rejects a display position beyond the next available position', async () => {
    await expect(
      service.create({
        name: 'Dental Cleaning',
        description: 'Professional cleaning.',
        durationMinutes: 45,
        displayOrder: 4,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(transaction.service.create).not.toHaveBeenCalled();
  });

  it('returns not found when updating an unknown service', async () => {
    transaction.service.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { active: false })).rejects.toThrow(
      NotFoundException,
    );
    expect(transaction.service.update).not.toHaveBeenCalled();
  });

  it('moves a service without violating unique display positions', async () => {
    transaction.service.findUnique.mockResolvedValue({
      id: 'service-3',
      displayOrder: 3,
    });
    transaction.service.aggregate.mockResolvedValue({
      _max: { displayOrder: 3 },
    });
    transaction.service.findMany.mockResolvedValue([
      { id: 'service-2', displayOrder: 2 },
      { id: 'service-1', displayOrder: 1 },
    ]);
    transaction.service.update.mockResolvedValue({ id: 'service-3' });

    await service.update('service-3', { displayOrder: 1 });

    expect(transaction.service.update.mock.calls).toEqual(
      expect.arrayContaining([
        [{ where: { id: 'service-3' }, data: { displayOrder: 4 } }],
        [{ where: { id: 'service-2' }, data: { displayOrder: 3 } }],
        [{ where: { id: 'service-1' }, data: { displayOrder: 2 } }],
      ]),
    );
    expect(transaction.service.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'service-3' },
        data: expect.objectContaining({ displayOrder: 1 }),
      }),
    );
  });
});
