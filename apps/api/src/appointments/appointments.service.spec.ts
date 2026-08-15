import { BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentStatus, DayOfWeek } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from './appointments.service';

function futureClinicAppointment() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  date.setUTCHours(2, 0, 0, 0);
  return date;
}

function clinicParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    day: values.weekday.toUpperCase() as DayOfWeek,
    date: `${values.year}-${values.month}-${values.day}`,
  };
}

describe('AppointmentsService', () => {
  const transaction = {
    clinic: { findFirst: jest.fn(), findUnique: jest.fn() },
    dentist: { findUnique: jest.fn() },
    service: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn(), create: jest.fn() },
    appointment: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new AppointmentsService(prisma as unknown as PrismaService);
  const scheduledAt = futureClinicAppointment();
  const local = clinicParts(scheduledAt);
  const dto = {
    firstName: 'Jamie',
    lastName: 'Santos',
    email: 'jamie@example.test',
    phone: '+63 917 555 0101',
    dentistId: 'dentist-1',
    serviceId: 'service-1',
    scheduledAt: scheduledAt.toISOString(),
    privacyConsent: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.clinic.findFirst.mockResolvedValue({
      id: 'clinic-1',
      timeZone: 'Asia/Manila',
    });
    transaction.clinic.findUnique.mockResolvedValue({
      id: 'clinic-1',
      hours: [{ day: local.day, startTime: '09:00', endTime: '18:00' }],
      blockedDates: [],
    });
    transaction.dentist.findUnique.mockResolvedValue({
      id: dto.dentistId,
      active: true,
      schedules: [{ day: local.day, startTime: '09:00', endTime: '17:00' }],
    });
    transaction.service.findUnique.mockResolvedValue({
      id: dto.serviceId,
      active: true,
      durationMinutes: 60,
    });
    transaction.patient.findUnique.mockResolvedValue(null);
    transaction.patient.create.mockResolvedValue({ id: 'patient-1' });
    transaction.appointment.findFirst.mockResolvedValue(null);
    transaction.appointment.count.mockResolvedValue(0);
    transaction.appointment.create.mockResolvedValue({
      id: 'appointment-1',
      status: AppointmentStatus.PENDING,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
  });

  it('rejects a past appointment before opening a transaction', async () => {
    await expect(
      service.create({
        ...dto,
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toThrow(
      new BadRequestException('scheduledAt must be a future date and time.'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a filled honeypot before opening a transaction', async () => {
    await expect(
      service.create({ ...dto, website: 'https://spam.example' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an inactive dentist', async () => {
    transaction.dentist.findUnique.mockResolvedValue({
      id: dto.dentistId,
      active: false,
      schedules: [],
    });

    await expect(service.create(dto)).rejects.toThrow(
      new BadRequestException('Dentist is not active.'),
    );
  });

  it('rejects a date blocked by the clinic', async () => {
    transaction.clinic.findUnique.mockResolvedValue({
      id: 'clinic-1',
      hours: [{ day: local.day, startTime: '09:00', endTime: '18:00' }],
      blockedDates: [{ date: local.date }],
    });

    await expect(service.create(dto)).rejects.toMatchObject({
      response: {
        code: 'APPOINTMENT_SLOT_UNAVAILABLE',
      },
    });
    expect(transaction.patient.create).not.toHaveBeenCalled();
  });

  it('rejects a conflicting appointment inside the transaction', async () => {
    transaction.appointment.findFirst.mockResolvedValue({ id: 'existing-1' });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(transaction.appointment.create).not.toHaveBeenCalled();
  });

  it('creates the patient and a pending appointment after validation', async () => {
    await expect(service.create(dto)).resolves.toEqual({
      id: 'appointment-1',
      status: AppointmentStatus.PENDING,
    });
    expect(transaction.patient.create).toHaveBeenCalledWith({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
      },
      select: { id: true },
    });
    expect(transaction.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'patient-1',
          dentistId: dto.dentistId,
          serviceId: dto.serviceId,
          scheduledAt,
          status: AppointmentStatus.PENDING,
          privacyConsentAt: expect.any(Date),
        }),
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          endAt: true,
          dentist: { select: { name: true, title: true } },
          service: { select: { name: true, durationMinutes: true } },
        },
      }),
    );
  });

  it('does not overwrite an existing patient when contact details differ', async () => {
    transaction.patient.findUnique.mockResolvedValue({
      id: 'patient-1',
      firstName: 'Different',
      lastName: 'Patient',
      phone: '+63 900 000 0000',
    });

    await expect(service.create(dto)).rejects.toMatchObject({
      response: {
        code: 'APPOINTMENT_CONTACT_VERIFICATION_REQUIRED',
      },
    });
    expect(transaction.patient.create).not.toHaveBeenCalled();
    expect(transaction.appointment.create).not.toHaveBeenCalled();
  });

  it('limits future pending requests for an existing patient', async () => {
    transaction.patient.findUnique.mockResolvedValue({
      id: 'patient-1',
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });
    transaction.appointment.count.mockResolvedValue(3);

    await expect(service.create(dto)).rejects.toMatchObject({
      response: {
        code: 'APPOINTMENT_PENDING_LIMIT_REACHED',
      },
    });
    expect(transaction.appointment.create).not.toHaveBeenCalled();
  });
});
