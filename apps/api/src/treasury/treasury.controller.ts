import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  cancelExpenseSchema,
  createClosingSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  createTransferSchema,
  expectedClosingQuerySchema,
  movementsQuerySchema,
  periodQuerySchema,
  updateCashAccountSchema,
  updateExpenseCategorySchema,
  type CancelExpenseInput,
  type CashAccountDto,
  type CashMovementsDto,
  type ClosingDto,
  type CreateClosingInput,
  type CreateExpenseCategoryInput,
  type CreateExpenseInput,
  type CreateTransferInput,
  type ExpectedClosingDto,
  type ExpenseCategoryDto,
  type ExpenseDto,
  type MovementsQuery,
  type PeriodQuery,
  type ShopSummaryDto,
  type StatsSummaryDto,
  type TreasuryDto,
  type UpdateCashAccountInput,
  type UpdateExpenseCategoryInput,
} from '@nagaw/shared';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { ExpensesService } from './expenses.service.js';
import { StatsService } from './stats.service.js';
import { TreasuryService } from './treasury.service.js';

const closingListQuerySchema = z
  .object({ accountId: z.uuid('Identifiant invalide').optional() })
  .strict();

/**
 * Statistics, cash accounts, expenses, transfers and cash counts (ADR-027).
 * A replayed creation (same clientOperationId) answers 200 instead of 201.
 */
@Controller()
export class TreasuryController {
  constructor(
    private readonly treasury: TreasuryService,
    private readonly expenses: ExpensesService,
    private readonly stats: StatsService,
  ) {}

  // Statistics ---------------------------------------------------------------

  @Get('stats/summary')
  @RequirePermission('stats.read')
  summary(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQuery,
  ): Promise<StatsSummaryDto> {
    return this.stats.summary(tenant, query);
  }

  /** Across the person's shops: no active shop, each membership checked. */
  @Get('stats/shops')
  shops(
    @CurrentUser() user: AuthContext,
    @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQuery,
  ): Promise<ShopSummaryDto[]> {
    return this.stats.shops(user.userId, query);
  }

  // Cash accounts --------------------------------------------------------------

  @Get('treasury')
  @RequirePermission('treasury.read')
  overview(@CurrentTenant() tenant: TenantContext): Promise<TreasuryDto> {
    return this.treasury.treasury(tenant);
  }

  @Get('treasury/movements')
  @RequirePermission('treasury.read')
  movements(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(movementsQuerySchema)) query: MovementsQuery,
  ): Promise<CashMovementsDto> {
    return this.treasury.movements(tenant, query);
  }

  @Patch('treasury/accounts/:id')
  @RequirePermission('treasury.manage')
  updateAccount(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCashAccountSchema))
    body: UpdateCashAccountInput,
    @RequestId() requestId: string | null,
  ): Promise<CashAccountDto> {
    return this.treasury.updateAccount(tenant, user, id, body, requestId);
  }

  @Post('treasury/transfers')
  @RequirePermission('treasury.manage')
  async transfer(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createTransferSchema))
    body: CreateTransferInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TreasuryDto> {
    const { treasury, replayed } = await this.treasury.createTransfer(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return treasury;
  }

  // Cash counts ----------------------------------------------------------------

  @Get('treasury/closings')
  @RequirePermission('treasury.read')
  closings(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(closingListQuerySchema))
    query: z.infer<typeof closingListQuerySchema>,
  ): Promise<ClosingDto[]> {
    return this.treasury.listClosings(tenant, query.accountId);
  }

  @Get('treasury/closings/expected')
  @RequirePermission('treasury.read')
  expected(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(expectedClosingQuerySchema))
    query: z.infer<typeof expectedClosingQuerySchema>,
  ): Promise<ExpectedClosingDto> {
    return this.treasury.expectedClosing(
      tenant,
      query.cashAccountId,
      query.day,
    );
  }

  @Post('treasury/closings')
  @RequirePermission('treasury.manage')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createClosingSchema)) body: CreateClosingInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClosingDto> {
    const { closing, replayed } = await this.treasury.createClosing(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return closing;
  }

  // Expenses -------------------------------------------------------------------

  @Get('expense-categories')
  @RequirePermission('treasury.read')
  categories(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<ExpenseCategoryDto[]> {
    return this.expenses.listCategories(tenant.organizationId);
  }

  @Post('expense-categories')
  @RequirePermission('treasury.manage')
  createCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createExpenseCategorySchema))
    body: CreateExpenseCategoryInput,
    @RequestId() requestId: string | null,
  ): Promise<ExpenseCategoryDto> {
    return this.expenses.createCategory(tenant, user, body, requestId);
  }

  @Patch('expense-categories/:id')
  @RequirePermission('treasury.manage')
  updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseCategorySchema))
    body: UpdateExpenseCategoryInput,
    @RequestId() requestId: string | null,
  ): Promise<ExpenseCategoryDto> {
    return this.expenses.updateCategory(tenant, user, id, body, requestId);
  }

  @Get('expenses')
  @RequirePermission('treasury.read')
  listExpenses(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQuery,
  ): Promise<ExpenseDto[]> {
    return this.expenses.list(tenant, query);
  }

  @Post('expenses')
  @RequirePermission('treasury.manage')
  async createExpense(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ExpenseDto> {
    const { expense, replayed } = await this.expenses.create(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return expense;
  }

  /** Raw image body (WebP, JPEG or PNG), resized on the device. */
  @Put('expenses/:id/receipt')
  @RequirePermission('treasury.manage')
  setReceipt(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @RequestId() requestId: string | null,
  ): Promise<ExpenseDto> {
    return this.expenses.setReceipt(
      tenant,
      user,
      id,
      contentType,
      body,
      requestId,
    );
  }

  @Get('expenses/:id/receipt')
  @RequirePermission('treasury.read')
  async receipt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const receipt = await this.expenses.receipt(tenant.organizationId, id);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('ETag', `"${receipt.sha256}"`);
    return new StreamableFile(receipt.data, { type: receipt.contentType });
  }

  @Post('expenses/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('treasury.manage')
  cancelExpense(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelExpenseSchema)) body: CancelExpenseInput,
    @RequestId() requestId: string | null,
  ): Promise<ExpenseDto> {
    return this.expenses.cancel(tenant, user, id, body, requestId);
  }
}
