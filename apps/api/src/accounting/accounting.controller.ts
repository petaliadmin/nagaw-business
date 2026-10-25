import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  fiscalYearQuerySchema,
  periodQuerySchema,
  type JournalDto,
  type PeriodQuery,
  type StatementDto,
} from '@nagaw/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import type { TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentTenant } from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { AccountingService } from './accounting.service.js';

type YearQuery = z.infer<typeof fiscalYearQuerySchema>;

function download(res: Response, file: { name: string; body: string }): string {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  return file.body;
}

/** Journal of receipts and expenses, end of year statement (ADR-028). */
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('journal')
  @RequirePermission('accounting.read')
  journal(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQuery,
  ): Promise<JournalDto> {
    return this.accounting.journal(tenant, query);
  }

  @Get('journal.csv')
  @RequirePermission('accounting.read')
  @Header('Cache-Control', 'private, no-store')
  async journalCsv(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(periodQuerySchema)) query: PeriodQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return download(res, await this.accounting.journalCsv(tenant, query));
  }

  @Get('statement')
  @RequirePermission('accounting.read')
  statement(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(fiscalYearQuerySchema)) query: YearQuery,
  ): Promise<StatementDto> {
    return this.accounting.statement(tenant, query.year);
  }

  @Get('statement.csv')
  @RequirePermission('accounting.read')
  @Header('Cache-Control', 'private, no-store')
  async statementCsv(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(fiscalYearQuerySchema)) query: YearQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return download(
      res,
      await this.accounting.statementCsv(tenant, query.year),
    );
  }
}
