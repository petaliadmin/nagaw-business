import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
  createProductSchema,
  createProductUnitSchema,
  createStockMovementSchema,
  productListQuerySchema,
  updateProductSchema,
  updateProductUnitSchema,
  type CreateProductInput,
  type CreateProductUnitInput,
  type CreateStockMovementInput,
  type ProductDto,
  type ProductListQuery,
  type RecordedStockMovementDto,
  type StockMovementDto,
  type StockSummaryDto,
  type UpdateProductInput,
  type UpdateProductUnitInput,
} from '@nagaw/shared';
import type { Response } from 'express';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { AlertsService } from '../notifications/alerts.service.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { ProductsService } from './products.service.js';
import { StockService } from './stock.service.js';

/**
 * Products and their stock. A replayed creation (same clientOperationId)
 * answers 200 with the original result instead of 201 (ADR-020).
 */
@Controller()
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly stock: StockService,
    private readonly alerts: AlertsService,
  ) {}

  @Get('products')
  @RequirePermission('catalog.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(productListQuerySchema))
    query: ProductListQuery,
  ): Promise<ProductDto[]> {
    return this.products.list(tenant.organizationId, query);
  }

  @Post('products')
  @RequirePermission('catalog.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProductDto> {
    const { product, replayed } = await this.products.create(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return product;
  }

  @Get('products/:id')
  @RequirePermission('catalog.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ProductDto> {
    return this.products.get(tenant.organizationId, id);
  }

  @Patch('products/:id')
  @RequirePermission('catalog.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
    @RequestId() requestId: string | null,
  ): Promise<ProductDto> {
    return this.products.update(tenant, user, id, body, requestId);
  }

  /** Another unit the product is sold in (ADR-038). */
  @Post('products/:id/units')
  @RequirePermission('catalog.manage')
  async createUnit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createProductUnitSchema))
    body: CreateProductUnitInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProductDto> {
    const { product, replayed } = await this.products.createUnit(
      tenant,
      user,
      id,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return product;
  }

  @Patch('products/:id/units/:unitId')
  @RequirePermission('catalog.manage')
  updateUnit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Param('unitId') unitId: string,
    @Body(new ZodValidationPipe(updateProductUnitSchema))
    body: UpdateProductUnitInput,
    @RequestId() requestId: string | null,
  ): Promise<ProductDto> {
    return this.products.updateUnit(tenant, user, id, unitId, body, requestId);
  }

  @Get('products/:id/photo')
  @RequirePermission('catalog.read')
  async photo(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const photo = await this.products.photo(tenant.organizationId, id);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('ETag', `"${photo.sha256}"`);
    return new StreamableFile(photo.data, { type: photo.contentType });
  }

  /** Raw image body (WebP, JPEG or PNG), resized on the device. */
  @Put('products/:id/photo')
  @RequirePermission('catalog.manage')
  setPhoto(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @RequestId() requestId: string | null,
  ): Promise<ProductDto> {
    return this.products.setPhoto(
      tenant,
      user,
      id,
      contentType,
      body,
      requestId,
    );
  }

  @Delete('products/:id/photo')
  @RequirePermission('catalog.manage')
  removePhoto(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<ProductDto> {
    return this.products.removePhoto(tenant, user, id, requestId);
  }

  @Get('products/:id/movements')
  @RequirePermission('catalog.read')
  movements(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<StockMovementDto[]> {
    return this.stock.movements(tenant.organizationId, id);
  }

  /** Sellers may record deliveries; the service keeps the rest for managers. */
  @Post('products/:id/movements')
  @RequirePermission('stock.receive')
  async move(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createStockMovementSchema))
    body: CreateStockMovementInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RecordedStockMovementDto> {
    const { result, replayed } = await this.stock.record(
      tenant,
      user,
      id,
      body,
      requestId,
    );
    await this.alerts.flush(tenant.organizationId);
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Get('stock/summary')
  @RequirePermission('catalog.read')
  summary(@CurrentTenant() tenant: TenantContext): Promise<StockSummaryDto> {
    return this.stock.summary(tenant.organizationId);
  }
}
