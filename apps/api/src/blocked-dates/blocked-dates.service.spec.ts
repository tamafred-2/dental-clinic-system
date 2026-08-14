import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockedDatesService } from './blocked-dates.service';

function futureDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

describe('BlockedDatesService', () => {
  const prisma = {
    clinic: { findFirst: jest.fn() },
    blockedDate: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new BlockedDatesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.clinic.findFirst.mockResolvedValue({
      id: 'clinic-1',
      timeZone: 'Asia/Manila',
    });
  });

  it('creates a future full-day clinic closure', async () => {
    const date = futureDate();
    prisma.blockedDate.create.mockResolvedValue({
      id: 'blocked-1',
      date,
      reason: 'Clinic maintenance',
    });

    await service.create({ date, reason: '  Clinic maintenance  ' });

    expect(prisma.blockedDate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          clinicId: 'clinic-1',
          date,
          reason: 'Clinic maintenance',
        },
      }),
    );
  });

  it('rejects an invalid calendar date', async () => {
    await expect(service.create({ date: '2026-02-30' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
  });

  it('returns not found when removing an unknown clinic closure', async () => {
    prisma.blockedDate.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
