import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  planChangeRequestSchema,
  type PlanChangeRequestInput,
  type PlanDto,
  type SubscriptionDto,
} from '@nagaw/shared';
import { Public } from '../auth/public.decorator.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { SubscriptionsService } from './subscriptions.service.js';

/** Offers, the shop's subscription and its requests to change (ADR-029). */
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /**
   * The offer grid: the same for everyone, and public (ADR-034), so that
   * the home page shows the prices. No shop data: names, prices and limits.
   */
  @Public()
  @Get('plans')
  plans(): Promise<PlanDto[]> {
    return this.subscriptions.plans();
  }

  @Get('subscription')
  @RequirePermission('subscription.read')
  subscription(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.subscription(tenant.organizationId);
  }

  @Post('subscription/requests')
  @RequirePermission('subscription.manage')
  request(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(planChangeRequestSchema))
    body: PlanChangeRequestInput,
    @RequestId() requestId: string | null,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.requestChange(
      tenant,
      user,
      body.planKey,
      requestId,
    );
  }

  @Post('subscription/requests/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('subscription.manage')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @RequestId() requestId: string | null,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.cancelRequest(tenant, user, requestId);
  }
}
