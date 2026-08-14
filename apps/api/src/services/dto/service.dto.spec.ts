import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
import { UpdateServiceDto } from './update-service.dto';

describe('service DTOs', () => {
  it('trims and accepts valid service text', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: '  Dental Consultation  ',
      description: '  Oral assessment and treatment planning.  ',
      durationMinutes: 30,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('Dental Consultation');
    expect(dto.description).toBe('Oral assessment and treatment planning.');
  });

  it('rejects whitespace-only service text', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: '   ',
      description: '   ',
      durationMinutes: 30,
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'description']),
    );
  });

  it('trims optional update text', async () => {
    const dto = plainToInstance(UpdateServiceDto, {
      name: '  Dental Cleaning  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('Dental Cleaning');
  });
});
