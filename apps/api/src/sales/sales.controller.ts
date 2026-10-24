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
  Res,
} from '@nestjs/common';
import {
  cancelSaleSchema,
  createCustomerSchema,
  createSaleSchema,
  customerRepaymentSchema,
  saleListQuerySchema,
  updateCustomerSchema,
  type CancelSaleInput,
  type CreateCustomerInput,
  type CreateSaleInput,
  type CustomerDetailDto,
  type CustomerDto,
  type CustomerRepaymentInput,
  type SaleDto,
  type SaleListItemDto,
  type SaleListQuery,
  type SalesDaySummaryDto,
  type UpdateCustomerInput,
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
import { CustomersService } from './customers.service.js';
import { SalesService } from './sales.service.js';

const customerListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    owing: z.enum(['true']).optional(),
  })
  .strict();

/**
 * Sales at the counter and customers (ADR-024). A replayed creation (same
 * clientOperationId) answers 200 with the original result instead of 201.
 */
@Controller()
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly customers: CustomersService,
  ) {}

  @Get('sales')
  @RequirePermission('sales.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Query(new ZodValidationPipe(saleListQuerySchema)) query: SaleListQuery,
  ): Promise<SaleListItemDto[]> {
    return this.sales.list(tenant, user, query.day);
  }

  @Get('sales/summary')
  @RequirePermission('sales.read')
  summary(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Query(new ZodValidationPipe(saleListQuerySchema)) query: SaleListQuery,
  ): Promise<SalesDaySummaryDto> {
    return this.sales.summary(tenant, user, query.day);
  }

  @Post('sales')
  @RequirePermission('sales.create')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createSaleSchema)) body: CreateSaleInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SaleDto> {
    const { sale, replayed } = await this.sales.create(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return sale;
  }

  @Get('sales/:id')
  @RequirePermission('sales.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
  ): Promise<SaleDto> {
    return this.sales.get(tenant, user, id);
  }

  @Post('sales/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.cancel')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelSaleSchema)) body: CancelSaleInput,
    @RequestId() requestId: string | null,
  ): Promise<SaleDto> {
    return this.sales.cancel(tenant, user, id, body, requestId);
  }

  @Get('customers')
  @RequirePermission('customers.read')
  listCustomers(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(customerListQuerySchema))
    query: z.infer<typeof customerListQuerySchema>,
  ): Promise<CustomerDto[]> {
    return this.customers.list(tenant.organizationId, {
      q: query.q,
      owing: query.owing === 'true',
    });
  }

  @Post('customers')
  @RequirePermission('customers.manage')
  async createCustomer(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createCustomerSchema))
    body: CreateCustomerInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerDto> {
    const { customer, replayed } = await this.customers.createAlone(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return customer;
  }

  @Get('customers/:id')
  @RequirePermission('customers.read')
  getCustomer(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerDetailDto> {
    return this.customers.get(tenant.organizationId, id);
  }

  @Patch('customers/:id')
  @RequirePermission('customers.manage')
  updateCustomer(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema))
    body: UpdateCustomerInput,
    @RequestId() requestId: string | null,
  ): Promise<CustomerDto> {
    return this.customers.update(tenant, user, id, body, requestId);
  }

  @Post('customers/:id/payments')
  @RequirePermission('customers.manage')
  async repay(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(customerRepaymentSchema))
    body: CustomerRepaymentInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerDto> {
    const { customer, replayed } = await this.customers.repay(
      tenant,
      user,
      id,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return customer;
  }
}
