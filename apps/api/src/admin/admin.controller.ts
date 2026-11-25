import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_DATA_KINDS,
  adminPlanUpdateSchema,
  type AdminPlanDto,
  type AdminPlanUpdateInput,
  adminDataActionSchema,
  adminDataQuerySchema,
  type AdminDataItemDto,
  type AdminDataKind,
  type AdminDataQuery,
  adminArchiveSchema,
  adminUserQuerySchema,
  type AdminArchiveInput,
  type AdminUserDto,
  type AdminUserQuery,
  adminInvoiceDecisionSchema,
  adminInvoiceQuerySchema,
  adminRenewSchema,
  adminSubscriptionSettingsSchema,
  type AdminInvoiceDecisionInput,
  type AdminInvoiceDto,
  type AdminRenewInput,
  type AdminSubscriptionSettingsInput,
  adminOpenAccessSchema,
  adminSetPinSchema,
  adminRequestQuerySchema,
  adminResolveRequestSchema,
  adminSetPlanSchema,
  adminShopQuerySchema,
  adminSuspendSchema,
  adminSyncQuerySchema,
  type AdminActivityDto,
  type AdminFinancesDto,
  type AdminOpenAccessInput,
  type AdminOverviewDto,
  type AdminPlanRequestDto,
  type AdminResolveRequestInput,
  type AdminSetPinInput,
  type AdminSetPlanInput,
  type AdminShopDto,
  type AdminShopListItemDto,
  type AdminShopQuery,
  type AdminSuspendInput,
  type AdminSyncDto,
} from '@nagaw/shared';
import { z } from 'zod';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PhoneAuthService } from '../phone-auth/phone-auth.service.js';
import { CurrentUser, RequestId } from '../tenancy/current.decorator.js';
import { AdminDataService } from './admin-data.service.js';
import { AdminPlansService } from './admin-plans.service.js';
import { AdminService } from './admin.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

/**
 * Platform administration (ADR-030). No active shop: these routes act
 * across shops, for platform administrators only, on accounts and offers,
 * and open or close the administrator's access to a shop (ADR-040).
 */
@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly phoneAuth: PhoneAuthService,
    private readonly shopData: AdminDataService,
    private readonly plans: AdminPlansService,
  ) {}

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
  shop(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
  ): Promise<AdminShopDto> {
    return this.admin.shop(id, user.userId);
  }

  @Post('shops/:id/access')
  @HttpCode(HttpStatus.OK)
  openAccess(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminOpenAccessSchema))
    body: AdminOpenAccessInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.openAccess(user, id, body.reason, requestId);
  }

  @Post('shops/:id/access/close')
  @HttpCode(HttpStatus.OK)
  closeAccess(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.closeAccess(user, id, requestId);
  }

  @Post('shops/:id/plan')
  @HttpCode(HttpStatus.OK)
  setPlan(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminSetPlanSchema)) body: AdminSetPlanInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.setPlan(
      user,
      id,
      body.planKey,
      body.note,
      requestId,
      body.period,
    );
  }

  /** « Prolonger » by hand, the payment received (ADR-073). */
  @Post('shops/:id/renew')
  @HttpCode(HttpStatus.OK)
  renew(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminRenewSchema)) body: AdminRenewInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.renew(user, id, body.period, body.note, requestId);
  }

  /** Automatic renewal, and the lifetime subscription (ADR-073). */
  @Patch('shops/:id/subscription')
  subscriptionSettings(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminSubscriptionSettingsSchema))
    body: AdminSubscriptionSettingsInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.subscriptionSettings(user, id, body, requestId);
  }

  /** The offers: prices, limits and modules, set here (ADR-075). */
  @Get('plans')
  planList(): Promise<AdminPlanDto[]> {
    return this.plans.list();
  }

  @Patch('plans/:key')
  updatePlan(
    @CurrentUser() user: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(adminPlanUpdateSchema))
    body: AdminPlanUpdateInput,
  ): Promise<AdminPlanDto> {
    return this.plans.update(user, key, body);
  }

  @Get('invoices')
  invoices(
    @Query(new ZodValidationPipe(adminInvoiceQuerySchema))
    query: z.infer<typeof adminInvoiceQuerySchema>,
  ): Promise<AdminInvoiceDto[]> {
    return this.admin.invoices(query.status === 'pending');
  }

  @Post('invoices/:id/paid')
  @HttpCode(HttpStatus.OK)
  invoicePaid(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminInvoiceDecisionSchema))
    body: AdminInvoiceDecisionInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.decideInvoice(user, id, 'paid', body.note, requestId);
  }

  @Post('invoices/:id/cancel')
  @HttpCode(HttpStatus.OK)
  invoiceCancel(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminInvoiceDecisionSchema))
    body: AdminInvoiceDecisionInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.decideInvoice(
      user,
      id,
      'cancelled',
      body.note,
      requestId,
    );
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

  /** Hidden and closed, never erased; restorable (ADR-074). */
  @Post('shops/:id/archive')
  @HttpCode(HttpStatus.OK)
  archiveShop(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminArchiveSchema)) body: AdminArchiveInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.setShopArchived(user, id, body.reason, requestId);
  }

  @Post('shops/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreShop(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<AdminShopDto> {
    return this.admin.setShopArchived(user, id, null, requestId);
  }

  @Get('users')
  users(
    @Query(new ZodValidationPipe(adminUserQuerySchema)) query: AdminUserQuery,
  ): Promise<AdminUserDto[]> {
    return this.admin.users(query);
  }

  @Post('users/:id/archive')
  @HttpCode(HttpStatus.OK)
  archiveUser(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminArchiveSchema)) body: AdminArchiveInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminUserDto> {
    return this.admin.setUserArchived(user, id, body.reason, requestId);
  }

  @Post('users/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreUser(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<AdminUserDto> {
    return this.admin.setUserArchived(user, id, null, requestId);
  }

  /** Products, customers, sales… of a shop (ADR-074). */
  @Get('shops/:id/data/:kind')
  shopDataList(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Param('kind', new ZodValidationPipe(z.enum(ADMIN_DATA_KINDS)))
    kind: AdminDataKind,
    @Query(new ZodValidationPipe(adminDataQuerySchema)) query: AdminDataQuery,
  ): Promise<AdminDataItemDto[]> {
    return this.shopData.list(user, id, kind, query);
  }

  @Post('shops/:id/data/:kind/:itemId/:action')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dataAction(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Param('kind', new ZodValidationPipe(z.enum(ADMIN_DATA_KINDS)))
    kind: AdminDataKind,
    @Param('itemId') itemId: string,
    @Param(
      'action',
      new ZodValidationPipe(z.enum(['archive', 'restore', 'cancel'])),
    )
    action: 'archive' | 'restore' | 'cancel',
    @Body(new ZodValidationPipe(adminDataActionSchema))
    body: { reason: string },
    @RequestId() requestId: string | null,
  ): Promise<void> {
    if (action !== 'restore' && body.reason === '')
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Indiquez pourquoi.',
        [{ path: 'reason', message: 'Indiquez pourquoi' }],
      );
    await this.shopData.act(
      user,
      id,
      kind,
      itemId,
      action,
      body.reason,
      requestId,
    );
  }

  /** A forgotten secret code: the team gives a new one (ADR-058). */
  @Post('shops/:id/members/:userId/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  setPin(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(adminSetPinSchema)) body: AdminSetPinInput,
    @RequestId() requestId: string | null,
  ): Promise<void> {
    return this.phoneAuth.adminSetPin(user, id, userId, body.pin, requestId);
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

  @Get('finances')
  finances(): Promise<AdminFinancesDto> {
    return this.admin.finances();
  }

  @Get('activity')
  activity(): Promise<AdminActivityDto> {
    return this.admin.activity();
  }

  @Get('sync')
  sync(
    @Query(new ZodValidationPipe(adminSyncQuerySchema))
    query: z.infer<typeof adminSyncQuerySchema>,
  ): Promise<AdminSyncDto> {
    return this.admin.sync(query.days ?? 7);
  }
}
