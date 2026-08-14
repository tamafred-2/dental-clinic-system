import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const prisma = {
    dentist: { findUnique: jest.fn() },
    service: { findUnique: jest.fn() },
    clinic: { findFirst: jest.fn() },
    appointment: { findMany: jest.fn() },
  };
  const service = new AvailabilityService(prisma as unknown as PrismaService);
  const query = {
    dentistId: 'dentist-1',
    serviceId: 'service-1',
    date: '2030-01-07',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dentist.findUnique.mockResolvedValue({
      id: query.dentistId,
      active: true,
      schedules: [{ day: 'MONDAY', startTime: '09:00', endTime: '17:00' }],
    });
    prisma.service.findUnique.mockResolvedValue({
      id: query.serviceId,
      active: true,
      durationMinutes: 60,
    });
    prisma.clinic.findFirst.mockResolvedValue({
      timeZone: 'Asia/Manila',
      hours: [{ day: 'MONDAY', startTime: '09:00', endTime: '18:00' }],
      blockedDates: [],
    });
    prisma.appointment.findMany.mockResolvedValue([]);
  });

  it('returns 30-minute Manila-time slots inside clinic and dentist hours', async () => {
    const result = await service.findSlots(query);

    expect(result.timeZone).toBe('Asia/Manila');
    expect(result.slots).toHaveLength(15);
    expect(result.slots[0]).toMatchObject({ time: '09:00' });
    expect(result.slots.at(-1)).toMatchObject({ time: '16:00' });
  });

  it('removes every slot that overlaps an existing appointment', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        scheduledAt: new Date('2030-01-07T02:00:00.000Z'),
        endAt: new Date('2030-01-07T03:00:00.000Z'),
      },
    ]);

    const result = await service.findSlots(query);
    const times = result.slots.map((slot) => slot.time);

    expect(times).not.toContain('09:30');
    expect(times).not.toContain('10:00');
    expect(times).not.toContain('10:30');
    expect(times).toContain('11:00');
  });

  it('returns no slots for a full-day clinic closure', async () => {
    prisma.clinic.findFirst.mockResolvedValue({
      timeZone: 'Asia/Manila',
      hours: [{ day: 'MONDAY', startTime: '09:00', endTime: '18:00' }],
      blockedDates: [{ id: 'blocked-1' }],
    });

    await expect(service.findSlots(query)).resolves.toMatchObject({
      slots: [],
    });
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });
});
