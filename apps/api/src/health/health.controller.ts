import { Controller, Get, HttpStatus, Inject, Logger } from '@nestjs/common';
import type { HealthResponse } from '@nagaw/shared';
import { AUTH_PROBE, type AuthProbe } from '../auth/auth-probe.js';
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
    @Inject(AUTH_PROBE) private readonly authProbe: AuthProbe,
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

  /**
   * Readiness: the database answers and the Supabase project publishes the
   * keys needed to verify user tokens. 503 with the failing part otherwise.
   */
  @Get('ready')
  async ready(): Promise<{
    status: 'ready';
    database: 'ok';
    auth: 'ok';
  }> {
    const [database, auth] = await Promise.all([
      this.databaseReadiness(),
      this.authProbe.check(),
    ]);
    if (database !== 'ok' || auth !== 'ok') {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'NOT_READY',
        'Service partiellement indisponible.',
        [{ database, auth }],
      );
    }
    return { status: 'ready', database, auth };
  }

  private async databaseReadiness(): Promise<
    'ok' | 'not_configured' | 'unreachable'
  > {
    if (!this.database.isConfigured) return 'not_configured';
    try {
      await this.database.ping();
      return 'ok';
    } catch (error) {
      this.logger.error({ err: error }, 'Database readiness check failed');
      return 'unreachable';
    }
  }
}
