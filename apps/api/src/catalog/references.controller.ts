import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createCategorySchema,
  createSupplierSchema,
  createTaxRateSchema,
  updateCategorySchema,
  updateSupplierSchema,
  updateTaxRateSchema,
  type CategoryDto,
  type CreateCategoryInput,
  type CreateSupplierInput,
  type CreateTaxRateInput,
  type SupplierDto,
  type TaxRateDto,
  type UpdateCategoryInput,
  type UpdateSupplierInput,
  type UpdateTaxRateInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { ReferencesService } from './references.service.js';

/** Reference lists of the catalogue (ADR-023). */
@Controller()
export class ReferencesController {
  constructor(private readonly references: ReferencesService) {}

  @Get('tax-rates')
  @RequirePermission('catalog.read')
  listTaxRates(@CurrentTenant() tenant: TenantContext): Promise<TaxRateDto[]> {
    return this.references.listTaxRates(tenant.organizationId);
  }

  @Post('tax-rates')
  @RequirePermission('catalog.manage')
  createTaxRate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createTaxRateSchema)) body: CreateTaxRateInput,
    @RequestId() requestId: string | null,
  ): Promise<TaxRateDto> {
    return this.references.createTaxRate(tenant, user, body, requestId);
  }

  @Patch('tax-rates/:id')
  @RequirePermission('catalog.manage')
  updateTaxRate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTaxRateSchema)) body: UpdateTaxRateInput,
    @RequestId() requestId: string | null,
  ): Promise<TaxRateDto> {
    return this.references.updateTaxRate(tenant, user, id, body, requestId);
  }

  @Get('product-categories')
  @RequirePermission('catalog.read')
  listCategories(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<CategoryDto[]> {
    return this.references.listCategories(tenant.organizationId);
  }

  @Post('product-categories')
  @RequirePermission('catalog.manage')
  createCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createCategorySchema))
    body: CreateCategoryInput,
    @RequestId() requestId: string | null,
  ): Promise<CategoryDto> {
    return this.references.createCategory(tenant, user, body, requestId);
  }

  @Patch('product-categories/:id')
  @RequirePermission('catalog.manage')
  updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema))
    body: UpdateCategoryInput,
    @RequestId() requestId: string | null,
  ): Promise<CategoryDto> {
    return this.references.updateCategory(tenant, user, id, body, requestId);
  }

  @Get('suppliers')
  @RequirePermission('catalog.read')
  listSuppliers(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<SupplierDto[]> {
    return this.references.listSuppliers(tenant.organizationId);
  }

  @Post('suppliers')
  @RequirePermission('catalog.manage')
  createSupplier(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createSupplierSchema))
    body: CreateSupplierInput,
    @RequestId() requestId: string | null,
  ): Promise<SupplierDto> {
    return this.references.createSupplier(tenant, user, body, requestId);
  }

  @Patch('suppliers/:id')
  @RequirePermission('catalog.manage')
  updateSupplier(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema))
    body: UpdateSupplierInput,
    @RequestId() requestId: string | null,
  ): Promise<SupplierDto> {
    return this.references.updateSupplier(tenant, user, id, body, requestId);
  }
}
