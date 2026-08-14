import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import type { AuthenticatedRequest } from './guards/session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, expiresAt, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    response.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api',
      expires: expiresAt,
    });
    return { user };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.sessionToken);
    response.clearCookie(SESSION_COOKIE_NAME, { path: '/api' });
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.authUser };
  }
}
