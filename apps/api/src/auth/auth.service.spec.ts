import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    session: { create: jest.fn(), updateMany: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue('7') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a hashed server-side session for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@example.test',
      role: 'ADMIN',
      active: true,
      passwordHash: await argon2.hash('CorrectPassword!2026'),
    });

    const result = await service.login(' ADMIN@example.test ', 'CorrectPassword!2026');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.test' },
    });
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        expiresAt: expect.any(Date),
      }),
    });

    const createdSession = prisma.session.create.mock.calls[0][0].data as {
      tokenHash: string;
    };
    expect(createdSession.tokenHash).not.toBe(result.token);
    expect(createdSession.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same generic error for an unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('missing@example.test', 'WrongPassword!2026')).rejects.toEqual(
      new UnauthorizedException('Invalid email or password.'),
    );
  });

  it('revokes an existing session by its token hash', async () => {
    await service.logout('a'.repeat(64));

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash:
          'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb',
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
