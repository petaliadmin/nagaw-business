import { HttpException } from '@nestjs/common';

/**
 * HttpException carrying a stable machine-readable code for the error
 * envelope (see docs/API.md).
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown[],
  ) {
    super({ code, message, details }, status);
  }
}
