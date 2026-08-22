import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const event = {
    id: 'appointment.created:appointment-1',
    type: 'appointment.created' as const,
    occurredAt: '2030-01-01T00:00:00.000Z',
    appointment: {
      id: 'appointment-1',
      status: 'PENDING',
      scheduledAt: new Date('2030-01-02T01:00:00.000Z'),
      endAt: new Date('2030-01-02T02:00:00.000Z'),
      dentist: { name: 'Dr. Reyes', title: 'Dentist' },
      service: { name: 'Cleaning', durationMinutes: 60 },
      patient: {
        firstName: 'Jamie',
        lastName: 'Santos',
        email: 'jamie@example.test',
        phone: '+63 917 555 0101',
      },
      clinic: {
        name: 'Bright Smile Dental Clinic',
        address: 'Calasiao, Pangasinan, Philippines',
        phone: '+63 75 555 0142',
        email: 'hello@dentalclinic.test',
        timeZone: 'Asia/Manila',
        cancellationPolicy: 'Please contact the clinic to cancel or reschedule.',
        appointmentPolicy: 'Please arrive 10 minutes early with a valid photo ID.',
      },
    },
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService(values: Record<string, string> = {}) {
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new NotificationsService(config);
  }

  it('skips delivery when no n8n webhook is configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      createService().publishAppointmentCreated(event),
    ).resolves.toEqual({ delivered: false, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a bounded event with the shared secret and event id', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(
      createService({
        N8N_WEBHOOK_URL: 'https://n8n.example.test/webhook/appointments',
        N8N_WEBHOOK_SECRET: 'test-secret',
      }).publishAppointmentCreated(event),
    ).resolves.toEqual({ delivered: true, skipped: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://n8n.example.test/webhook/appointments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-event-id': event.id,
          'x-n8n-webhook-secret': 'test-secret',
        }),
        body: JSON.stringify(event),
      }),
    );
  });

  it('returns a failed delivery result instead of throwing', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }));

    await expect(
      createService({
        N8N_WEBHOOK_URL: 'https://n8n.example.test/webhook/appointments',
      }).publishAppointmentCreated(event),
    ).resolves.toEqual({ delivered: false, skipped: false });
  });
});
