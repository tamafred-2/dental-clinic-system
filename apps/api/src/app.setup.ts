import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { SESSION_COOKIE_NAME } from './auth/auth.constants';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

const bodyMethods = new Set(['POST', 'PUT', 'PATCH']);
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function resolveWebOrigin(
  configuredOrigin: string | undefined,
  isProduction: boolean,
) {
  if (isProduction && !configuredOrigin) {
    throw new Error('WEB_ORIGIN is required in production.');
  }

  const origin = configuredOrigin ?? 'http://localhost:3000';
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error('WEB_ORIGIN must be a valid HTTP or HTTPS origin.');
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.origin !== origin
  ) {
    throw new Error('WEB_ORIGIN must contain only one HTTP or HTTPS origin.');
  }
  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error('WEB_ORIGIN must use HTTPS in production.');
  }

  return origin;
}

export function configureApp(app: INestApplication) {
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const webOrigin = resolveWebOrigin(
    configService.get<string>('WEB_ORIGIN'),
    isProduction,
  );

  if (isProduction) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set(setting: string, value: number): void;
    };
    expressApp.set('trust proxy', 1);
  }

  app.use(
    helmet({
      frameguard: { action: 'deny' },
      contentSecurityPolicy: {
        directives: { frameAncestors: ["'none'"] },
      },
    }),
  );
  app.use(cookieParser());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    next();
  });
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, !origin || origin === webOrigin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const hasBody =
      Number(request.headers['content-length'] ?? 0) > 0 ||
      request.headers['transfer-encoding'] !== undefined;

    if (
      bodyMethods.has(request.method) &&
      hasBody &&
      !request.is('application/json')
    ) {
      response.status(415).json({
        statusCode: 415,
        message: 'Content-Type must be application/json.',
        error: 'Unsupported Media Type',
      });
      return;
    }

    const origin = request.get('origin');
    const sessionToken = request.cookies?.[SESSION_COOKIE_NAME] as unknown;
    if (
      unsafeMethods.has(request.method) &&
      typeof sessionToken === 'string' &&
      origin &&
      origin !== webOrigin
    ) {
      response.status(403).json({
        statusCode: 403,
        message: 'Request origin is not allowed.',
        error: 'Forbidden',
      });
      return;
    }

    next();
  });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  return { configService, isProduction };
}
