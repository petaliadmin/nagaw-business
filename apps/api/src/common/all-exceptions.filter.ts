import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@nagaw/shared';
import type { Request, Response } from 'express';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
};

/**
 * Maps every thrown error to the documented envelope. Client errors keep
 * their message; unexpected errors are logged with their stack and answered
 * with a generic 500 so internals never leak to the caller.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const requestId = request.id === undefined ? undefined : String(request.id);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: ApiError = {
        error: {
          code: STATUS_CODES[status] ?? `HTTP_${status}`,
          message: extractMessage(exception),
          requestId,
        },
      };
      if (status >= 500) {
        this.logger.error({ err: exception, requestId }, 'HTTP 5xx');
      }
      response.status(status).json(body);
      return;
    }

    this.logger.error({ err: exception, requestId }, 'Unhandled exception');
    const body: ApiError = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Une erreur interne est survenue.',
        requestId,
      },
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

function extractMessage(exception: HttpException): string {
  const payload = exception.getResponse();
  if (typeof payload === 'string') return payload;
  if (payload !== null && typeof payload === 'object' && 'message' in payload) {
    const { message } = payload as { message: unknown };
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return exception.message;
}
