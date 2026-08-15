import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

function isPayloadTooLarge(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  );
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (isPayloadTooLarge(exception)) {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'Request body is too large.',
        error: 'Payload Too Large',
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const details = exception.getResponse();
      response
        .status(status)
        .json(
          typeof details === 'string'
            ? { statusCode: status, message: details }
            : details,
        );
      return;
    }

    const errorName = exception instanceof Error ? exception.name : 'Unknown';
    this.logger.error(`Unhandled API error (${errorName}).`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error.',
      error: 'Internal Server Error',
    });
  }
}
