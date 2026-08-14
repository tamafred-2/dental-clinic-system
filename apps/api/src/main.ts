import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createServer } from 'node:net';
import { AppModule } from './app.module';

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  );
}

async function ensurePortIsAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const webOrigin: string =
    configService.get('WEB_ORIGIN') ?? 'http://localhost:3000';

  if (isProduction) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set(setting: string, value: number): void;
    };
    expressApp.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configuredPort =
    configService.get<string>('PORT') ??
    configService.get<string>('API_PORT') ??
    '4000';
  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT or API_PORT must be a valid TCP port number.');
  }

  try {
    await ensurePortIsAvailable(port);
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    await app.close();

    if (isAddressInUseError(error)) {
      throw new Error(
        `Port ${port} is already in use. Stop the existing API process, then start this API again.`,
      );
    }

    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown startup error.';
  Logger.error(message, undefined, 'Bootstrap');
  process.exitCode = 1;
});
