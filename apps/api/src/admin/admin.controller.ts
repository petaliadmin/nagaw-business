import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  adminRequestQuerySchema,
  adminResolveRequestSchema,
  adminSetPlanSchema,
  adminShopQuerySchema,
  adminSuspendSchema,
  adminSyncQuerySchema,
  type AdminOverviewDto,
  type AdminPlanRequestDto,
  type AdminResolveRequestInput,
  type AdminSetPlanInput,
  type AdminShopDto,
  type AdminShopListItemDto,
  type AdminShopQuery,
  type AdminSuspendInput,
  type AdminSyncDto,
} from '@nagaw/shared';
import type { z } from 'zod';
import type { AuthContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser, RequestId } from '../tenancy/current.decorator.js';
import { AdminService } from './admin.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

/**
 * Platform administration (ADR-030). No active shop: these routes act
 * across shops, for platform administrators only, on accounts and offers.
 */
@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview(): Promise<AdminOverviewDto> {
    return this.admin.overview();
  }

  @Get('shops')
  shops(
    @Query(new ZodValidationPipe(adminShopQuerySchema)) query: AdminShopQuery,
  ): Promise<AdminShopListItemDto[]> {
    return this.admin.shops(query);
  }

  @Get('shops/:id')
  shop(@Param('id') id: string): Promise<AdminShopDto> {
    return this.admin.shop(id);
  }

  @Post('shops/:id/plan')
  @HttpCode(HttpStatus.OK)
  setPlan(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminSetPlanSchema)) body: AdminSetPlanInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.setPlan(user, id, body.planKey, body.note, requestId);
  }

  @Post('shops/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminSuspendSchema)) body: AdminSuspendInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.setSuspended(user, id, body.reason, requestId);
  }

  @Post('shops/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.setSuspended(user, id, null, requestId);
  }

  @Get('plan-requests')
  requests(
    @Query(new ZodValidationPipe(adminRequestQuerySchema))
    query: z.infer<typeof adminRequestQuerySchema>,
  ): Promise<AdminPlanRequestDto[]> {
    return this.admin.requests(query.status !== 'all');
  }

  @Post('plan-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminResolveRequestSchema))
    body: AdminResolveRequestInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminPlanRequestDto> {
    return this.admin.resolveRequest(user, id, 'approve', body.note, requestId);
  }

  @Post('plan-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminResolveRequestSchema))
    body: AdminResolveRequestInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminPlanRequestDto> {
    return this.admin.resolveRequest(user, id, 'reject', body.note, requestId);
  }

  @Get('sync')
  sync(
    @Query(new ZodValidationPipe(adminSyncQuerySchema))
    query: z.infer<typeof adminSyncQuerySchema>,
  ): Promise<AdminSyncDto> {
    return this.admin.sync(query.days ?? 7);
  }
}
