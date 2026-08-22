import { AppointmentIntentStatus, AppointmentStatus } from '@prisma/client';
import { AiToolsService } from './ai-tools.service';

describe('AiToolsService', () => {
  const prisma = {
    clinic: { findFirst: jest.fn() },
    service: { findMany: jest.fn() },
    dentist: { findMany: jest.fn() },
    faq: { findMany: jest.fn() },
    appointmentIntent: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const availability = { findSlots: jest.fn() };
  const appointments = { create: jest.fn() };
  const context = {
    conversationId: 'conversation-1',
    latestPatientMessageId: 'message-1',
    latestPatientMessage:
      'I confirm this appointment request and agree to the privacy policy.',
  };
  let service: AiToolsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => unknown) =>
        callback(prisma),
    );
    service = new AiToolsService(
      prisma as never,
      availability as never,
      appointments as never,
    );
  });

  it('rejects unknown tools without accessing application services', async () => {
    const result = await service.execute('dropDatabase', '{}', context);

    expect(result.audit).toEqual({
      name: 'dropDatabase',
      success: false,
      code: 'TOOL_NOT_ALLOWED',
    });
    expect(availability.findSlots).not.toHaveBeenCalled();
    expect(appointments.create).not.toHaveBeenCalled();
  });

  it('validates tool arguments before checking availability', async () => {
    const result = await service.execute(
      'checkAvailability',
      '{"date":"tomorrow"}',
      context,
    );

    expect(result.audit.code).toBe('INVALID_TOOL_ARGUMENTS');
    expect(availability.findSlots).not.toHaveBeenCalled();
  });

  it('delegates live availability to the scheduling service', async () => {
    availability.findSlots.mockResolvedValue({
      date: '2030-01-10',
      timeZone: 'Asia/Manila',
      slots: [],
    });

    const result = await service.execute(
      'checkAvailability',
      JSON.stringify({
        dentistId: 'dentist-1',
        serviceId: 'service-1',
        date: '2030-01-10',
      }),
      context,
    );

    expect(availability.findSlots).toHaveBeenCalledWith({
      dentistId: 'dentist-1',
      serviceId: 'service-1',
      date: '2030-01-10',
    });
    expect(result.audit.success).toBe(true);
  });

  it('does not prepare an intent when the exact slot is unavailable', async () => {
    prisma.clinic.findFirst.mockResolvedValue({ timeZone: 'Asia/Manila' });
    availability.findSlots.mockResolvedValue({ slots: [] });

    const result = await service.execute(
      'prepareAppointmentRequest',
      JSON.stringify({
        dentistId: 'dentist-1',
        serviceId: 'service-1',
        scheduledAt: '2030-01-10T06:00:00.000Z',
      }),
      context,
    );

    expect(result.audit.code).toBe('SLOT_UNAVAILABLE');
    expect(prisma.appointmentIntent.create).not.toHaveBeenCalled();
  });

  it('prepares a short-lived intent without creating an appointment', async () => {
    prisma.clinic.findFirst.mockResolvedValue({ timeZone: 'Asia/Manila' });
    availability.findSlots.mockResolvedValue({
      slots: [{ scheduledAt: '2030-01-10T06:00:00.000Z' }],
    });
    prisma.appointmentIntent.create.mockResolvedValue({
      id: 'intent-1',
      scheduledAt: new Date('2030-01-10T06:00:00.000Z'),
      expiresAt: new Date('2030-01-01T00:15:00.000Z'),
      dentist: { name: 'Ava Santos', title: 'General Dentist' },
      service: { name: 'Dental Cleaning', durationMinutes: 45 },
    });

    const result = await service.execute(
      'prepareAppointmentRequest',
      JSON.stringify({
        dentistId: 'dentist-1',
        serviceId: 'service-1',
        scheduledAt: '2030-01-10T06:00:00.000Z',
      }),
      context,
    );

    expect(result.audit.code).toBe('APPOINTMENT_INTENT_PREPARED');
    expect(prisma.appointmentIntent.create).toHaveBeenCalled();
    expect(appointments.create).not.toHaveBeenCalled();
  });

  it('requires the exact confirmation and privacy consent before writing', async () => {
    prisma.appointmentIntent.findFirst.mockResolvedValue({
      id: 'intent-1',
      dentistId: 'dentist-1',
      serviceId: 'service-1',
      scheduledAt: new Date('2030-01-10T06:00:00.000Z'),
      status: AppointmentIntentStatus.PENDING,
      expiresAt: new Date('2030-01-10T05:00:00.000Z'),
      appointment: null,
      conversation: {
        patient: {
          firstName: 'Test',
          lastName: 'Patient',
          email: 'private@example.test',
          phone: '+63 900 000 0000',
        },
      },
    });

    const result = await service.execute(
      'createAppointmentRequest',
      '{"intentId":"intent-1"}',
      { ...context, latestPatientMessage: 'Yes, please book it.' },
    );

    expect(result.audit.code).toBe('EXPLICIT_CONFIRMATION_REQUIRED');
    expect(appointments.create).not.toHaveBeenCalled();
  });

  it('creates through the appointment service using server-owned patient data', async () => {
    const intent = {
      id: 'intent-1',
      dentistId: 'dentist-1',
      serviceId: 'service-1',
      scheduledAt: new Date('2030-01-10T06:00:00.000Z'),
      status: AppointmentIntentStatus.PENDING,
      expiresAt: new Date('2030-01-10T05:00:00.000Z'),
      appointment: null,
      conversation: {
        patient: {
          firstName: 'Test',
          lastName: 'Patient',
          email: 'private@example.test',
          phone: '+63 900 000 0000',
        },
      },
    };
    prisma.appointmentIntent.findFirst.mockResolvedValue(intent);
    appointments.create.mockResolvedValue({
      id: 'appointment-1',
      status: AppointmentStatus.PENDING,
      scheduledAt: intent.scheduledAt,
      endAt: new Date('2030-01-10T06:45:00.000Z'),
      dentist: { name: 'Ava Santos', title: 'General Dentist' },
      service: { name: 'Dental Cleaning', durationMinutes: 45 },
    });

    const result = await service.execute(
      'createAppointmentRequest',
      '{"intentId":"intent-1"}',
      context,
    );

    expect(appointments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'private@example.test',
        privacyConsent: true,
      }),
      { appointmentIntentId: 'intent-1' },
    );
    expect(result.audit).toEqual({
      name: 'createAppointmentRequest',
      success: true,
      code: 'APPOINTMENT_REQUEST_CREATED',
      resourceId: 'appointment-1',
    });
    expect(JSON.stringify(result.output)).not.toContain('private@example.test');
  });

  it('marks a human handoff as a forced escalation signal', async () => {
    const result = await service.execute(
      'requestHumanHandoff',
      '{"reason":"Patient requests staff assistance."}',
      context,
    );

    expect(result.requestedHandoff).toBe(true);
    expect(result.audit.code).toBe('HUMAN_HANDOFF_REQUESTED');
  });
});
