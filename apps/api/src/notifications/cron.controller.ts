import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers, HttpStatus, Inject } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { ApiException } from '../common/api-exception.js';
import { ENV, type Env } from '../config/env.js';
import { BillingService } from '../subscriptions/billing.service.js';
import { DailyService } from './daily.service.js';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by Vercel Cron (ADR-006) with `Authorization: Bearer CRON_SECRET`.
 * Not a user route: without the secret configured, it answers 503 and
 * does nothing.
 */
@Controller('cron')
export class CronController {
  constructor(
    private readonly daily: DailyService,
    private readonly billing: BillingService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get('daily')
  async run(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<{
    shops: number;
    pending: number;
    subscriptions: { renewed: number; expired: number; suspended: number };
  }> {
    const secret = this.env.CRON_SECRET;
    if (!secret)
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CRON_NOT_CONFIGURED',
        'Tâche planifiée non configurée.',
      );
    if (!authorization || !sameSecret(authorization, `Bearer ${secret}`))
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Authentification requise.',
      );
    // Ends of term and unpaid invoices first (ADR-073): a shop suspended
    // today gets no day's notifications.
    const subscriptions = await this.billing.runDue();
    return { ...(await this.daily.runDue()), subscriptions };
  }
}
