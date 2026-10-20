import { Controller, Get, HttpStatus, Inject, Logger } from '@nestjs/common';
import type { HealthResponse } from '@nagaw/shared';
import { Public } from '../auth/public.decorator.js';
import { ApiException } from '../common/api-exception.js';
import { ENV, type Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';

@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly database: DatabaseService,
  ) {}

  /** Liveness: the function runs. */
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'nagaw-api',
      version: this.env.APP_VERSION,
      environment: this.env.APP_ENV,
      time: new Date().toISOString(),
    };
  }

  /** Readiness: dependencies (database) are reachable. */
  @Get('ready')
  async ready(): Promise<{ status: 'ready'; database: 'ok' }> {
    if (!this.database.isConfigured) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_NOT_CONFIGURED',
        'La base de données n’est pas configurée.',
      );
    }
    try {
      await this.database.ping();
    } catch (error) {
      this.logger.error({ err: error }, 'Database readiness check failed');
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_UNREACHABLE',
        'La base de données est injoignable.',
      );
    }
    return { status: 'ready', database: 'ok' };
  }
}
