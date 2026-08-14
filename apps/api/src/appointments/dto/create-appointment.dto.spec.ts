import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

const validRequest = {
  firstName: '  Jamie ',
  lastName: ' Santos ',
  email: ' JAMIE@EXAMPLE.TEST ',
  phone: '+63 917 555 0101',
  dentistId: 'dentist-1',
  serviceId: 'service-1',
  scheduledAt: '2030-01-07T02:00:00.000Z',
  privacyConsent: true,
};

describe('CreateAppointmentDto', () => {
  it('normalizes and accepts a valid minimal request', async () => {
    const dto = plainToInstance(CreateAppointmentDto, validRequest);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.firstName).toBe('Jamie');
    expect(dto.email).toBe('jamie@example.test');
  });

  it('rejects invalid contact details and missing consent', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validRequest,
      email: 'not-an-email',
      phone: '12',
      privacyConsent: false,
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['email', 'phone', 'privacyConsent']),
    );
  });

  it('requires an explicit timezone in the appointment instant', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validRequest,
      scheduledAt: '2030-01-07T10:00:00',
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'scheduledAt')).toBe(true);
  });

  it('accepts an empty honeypot and normalizes its value', async () => {
    const dto = plainToInstance(CreateAppointmentDto, {
      ...validRequest,
      website: '   ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.website).toBe('');
  });
});
