import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  cancelOrderSchema,
  catalogSettingsSchema,
  connectWaveSchema,
  deliverOrderSchema,
  orderListQuerySchema,
  orderPaymentSchema,
  shipOrderSchema,
  type CancelOrderInput,
  type ConnectWaveInput,
  type CatalogSettingsDto,
  type CatalogSettingsInput,
  type DeliverOrderInput,
  type OrderCountsDto,
  type OrderDto,
  type OrderListQuery,
  type OrderPaymentInput,
  type ShipOrderInput,
  type WaveAccountDto,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { OrdersService } from './orders.service.js';
import { WaveService } from './wave.service.js';

/** Orders of the shop (ADR-063). */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly wave: WaveService,
  ) {}

  @Get()
  @RequirePermission('orders.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQuery,
  ): Promise<OrderDto[]> {
    return this.orders.list(tenant.organizationId, query);
  }

  @Get('counts')
  @RequirePermission('orders.read')
  counts(@CurrentTenant() tenant: TenantContext): Promise<OrderCountsDto> {
    return this.orders.counts(tenant.organizationId);
  }

  /** Settings of the public page: owner and managers. */
  @Get('settings')
  @RequirePermission('organization.update')
  settings(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<CatalogSettingsDto> {
    return this.orders.settings(tenant.organizationId);
  }

  @Put('settings')
  @RequirePermission('organization.update')
  updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(catalogSettingsSchema))
    body: CatalogSettingsInput,
    @RequestId() requestId: string | null,
  ): Promise<CatalogSettingsDto> {
    return this.orders.updateSettings(
      tenant.organizationId,
      user,
      body,
      requestId,
    );
  }

  /** The shop's Wave account (ADR-065): never its secrets. */
  @Get('wave')
  @RequirePermission('organization.update')
  waveAccount(@CurrentTenant() tenant: TenantContext): Promise<WaveAccountDto> {
    return this.wave.account(tenant.organizationId);
  }

  @Put('wave')
  @RequirePermission('organization.update')
  connectWave(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(connectWaveSchema)) body: ConnectWaveInput,
    @RequestId() requestId: string | null,
  ): Promise<WaveAccountDto> {
    return this.wave.connect(tenant.organizationId, user, body, requestId);
  }

  @Delete('wave')
  @RequirePermission('organization.update')
  disconnectWave(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @RequestId() requestId: string | null,
  ): Promise<WaveAccountDto> {
    return this.wave.disconnect(tenant.organizationId, user, requestId);
  }

  /** Asks Wave again how the payment of the order went. */
  @Post(':id/wave/check')
  @RequirePermission('orders.manage')
  async checkWave(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<OrderDto> {
    await this.wave.check(tenant.organizationId, id, user, requestId);
    return this.orders.get(tenant.organizationId, id);
  }

  @Get(':id')
  @RequirePermission('orders.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<OrderDto> {
    return this.orders.get(tenant.organizationId, id);
  }

  @Post(':id/confirm')
  @RequirePermission('orders.manage')
  confirm(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<OrderDto> {
    return this.orders.confirm(tenant, user, id, requestId);
  }

  @Post(':id/pay')
  @RequirePermission('orders.manage')
  pay(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(orderPaymentSchema)) body: OrderPaymentInput,
    @RequestId() requestId: string | null,
  ): Promise<OrderDto> {
    return this.orders.pay(tenant, user, id, body, requestId);
  }

  @Post(':id/ship')
  @RequirePermission('orders.manage')
  ship(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(shipOrderSchema)) body: ShipOrderInput,
    @RequestId() requestId: string | null,
  ): Promise<OrderDto> {
    return this.orders.ship(tenant, user, id, body, requestId);
  }

  /** Becomes a sale: the person needs the right to sell. */
  @Post(':id/deliver')
  @RequirePermission('sales.create')
  deliver(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(deliverOrderSchema)) body: DeliverOrderInput,
    @RequestId() requestId: string | null,
  ): Promise<OrderDto> {
    return this.orders.deliver(tenant, user, id, body, requestId);
  }

  @Post(':id/cancel')
  @RequirePermission('orders.manage')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) body: CancelOrderInput,
    @RequestId() requestId: string | null,
  ): Promise<OrderDto> {
    return this.orders.cancel(tenant, user, id, body, requestId);
  }
}
