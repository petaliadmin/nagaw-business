import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller.js';
import { BillingService } from './billing.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, BillingService],
  // The platform and the daily run renew and invoice (ADR-073).
  exports: [BillingService],
})
export class SubscriptionsModule {}
