import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Perform a hash operation even when the account is absent to reduce account-enumeration timing signals.
    const passwordIsValid = user
      ? await argon2.verify(user.passwordHash, password)
      : await this.verifyUnknownPassword(password);

    if (!user || !user.active || !passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const configuredSessionDays = Number(
      this.configService.get('SESSION_TTL_DAYS'),
    );
    const sessionDays = Number.isInteger(configuredSessionDays)
      ? configuredSessionDays
      : 7;
    if (sessionDays < 1 || sessionDays > 30) {
      throw new Error('SESSION_TTL_DAYS must be an integer between 1 and 30.');
    }
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(token: string | undefined) {
    if (!token) {
      return;
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async verifyUnknownPassword(password: string) {
    const hash = await argon2.hash('not-a-user-password', {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    return argon2.verify(hash, password);
  }
}
