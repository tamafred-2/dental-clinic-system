import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_COOKIE_NAME } from '../auth.constants';

export type AuthenticatedRequest = Request & {
  authUser?: { id: string; name: string; email: string; role: string };
  sessionToken?: string;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = (request as unknown as { cookies?: unknown }).cookies;
    const token =
      cookies && typeof cookies === 'object'
        ? (cookies as Record<string, unknown>)[SESSION_COOKIE_NAME]
        : undefined;

    if (typeof token !== 'string' || token.length !== 64) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active
    ) {
      throw new UnauthorizedException('Authentication is required.');
    }

    request.authUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    };
    request.sessionToken = token;
    return true;
  }
}
