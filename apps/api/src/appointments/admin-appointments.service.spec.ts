import { BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { AdminAppointmentsService } from './admin-appointments.service';

describe('AdminAppointmentsService', () => {
  const transaction = {
    appointment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = {
    clinic: { findFirst: jest.fn() },
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    conversation: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AdminAppointmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminAppointmentsService(prisma as never);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
  });

  it('returns overview statistics without patient data', async () => {
    prisma.clinic.findFirst.mockResolvedValue({ timeZone: 'Asia/Manila' });
    prisma.appointment.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(6);
    prisma.conversation.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);

    const result = await service.overview();

    expect(result.timeZone).toBe('Asia/Manila');
    expect(result.statistics).toEqual({
      todayAppointments: 4,
      pendingRequests: 2,
      confirmedAppointments: 3,
      cancelledAppointments: 1,
      noShowAppointments: 0,
      upcomingAppointments: 6,
      aiConversations: 5,
      humanHandoffs: 1,
    });
  });

  it('uses a paginated list selection that omits patient contact details', async () => {
    prisma.clinic.findFirst.mockResolvedValue({ timeZone: 'Asia/Manila' });
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.appointment.count.mockResolvedValue(0);

    await service.findAll({
      from: '2026-08-15',
      to: '2026-08-31',
      page: 1,
      limit: 25,
    });

    const query = prisma.appointment.findMany.mock.calls[0][0];
    expect(query.take).toBe(25);
    expect(query.skip).toBe(0);
    expect(query.select.patient.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
    });
    expect(query.select.patient.select.email).toBeUndefined();
    expect(query.select.patient.select.phone).toBeUndefined();
  });

  it('confirms a pending appointment using a concurrency-safe update', async () => {
    transaction.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1',
      status: AppointmentStatus.PENDING,
    });
    transaction.appointment.updateMany.mockResolvedValue({ count: 1 });
    transaction.appointment.findUniqueOrThrow.mockResolvedValue({
      id: 'appointment-1',
      status: AppointmentStatus.CONFIRMED,
    });

    const result = await service.updateStatus('appointment-1', {
      status: AppointmentStatus.CONFIRMED,
    });

    expect(transaction.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appointment-1',
        status: AppointmentStatus.PENDING,
      },
      data: {
        status: AppointmentStatus.CONFIRMED,
        cancellationReason: null,
      },
    });
    expect(result.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('requires a reason when cancelling an appointment', async () => {
    transaction.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1',
      status: AppointmentStatus.PENDING,
    });

    await expect(
      service.updateStatus('appointment-1', {
        status: AppointmentStatus.CANCELLED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects changes to a final appointment status', async () => {
    transaction.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1',
      status: AppointmentStatus.COMPLETED,
    });

    await expect(
      service.updateStatus('appointment-1', {
        status: AppointmentStatus.CONFIRMED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a reschedule time in the past before opening a transaction', async () => {
    await expect(
      service.reschedule('appointment-1', {
        scheduledAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
