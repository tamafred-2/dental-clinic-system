import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'node:net';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  );
}

async function ensurePortIsAvailable(
  port: number,
  host: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, host, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { configService, isProduction } = configureApp(app);

  const configuredPort =
    configService.get<string>('PORT') ??
    configService.get<string>('API_PORT') ??
    '4000';
  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT or API_PORT must be a valid TCP port number.');
  }
  const host =
    configService.get<string>('API_HOST') ??
    (isProduction ? '0.0.0.0' : '127.0.0.1');

  try {
    await ensurePortIsAvailable(port, host);
    await app.listen(port, host);
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
