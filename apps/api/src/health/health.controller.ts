import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@nagaw/shared';
import { ENV, type Env } from '../config/env.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Liveness probe. Readiness (database, queue) is added in Phase 2. */
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
}
