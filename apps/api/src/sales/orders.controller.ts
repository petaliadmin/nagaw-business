import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  acceptOrderSchema,
  declineOrderSchema,
  rescheduleOrderSchema,
  type AcceptOrderInput,
  type DeclineOrderInput,
  type RescheduleOrderInput,
  cancelOrderSchema,
  createOrderSchema,
  deliverOrderSchema,
  orderDepositSchema,
  orderListQuerySchema,
  orderStatusSchema,
  type CancelOrderInput,
  type CreateOrderInput,
  type DeliverOrderInput,
  type OrderDepositInput,
  type OrderDto,
  type OrderListQuery,
  type OrdersSummaryDto,
  type OrderStatusInput,
} from '@nagaw/shared';
import type { Response } from 'express';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AlertsService } from '../notifications/alerts.service.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { OrdersService } from './orders.service.js';

/**
 * Customer orders (ADR-072). Sellers take orders and deposits and hand
 * them over; the owner and the managers cancel and refund.
 */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly alerts: AlertsService,
  ) {}

  @Get()
  @RequirePermission('orders.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQuery,
  ): Promise<OrderDto[]> {
    return this.orders.list(tenant.organizationId, query);
  }

  @Get('summary')
  @RequirePermission('orders.read')
  summary(@CurrentTenant() tenant: TenantContext): Promise<OrdersSummaryDto> {
    return this.orders.summary(tenant.organizationId);
  }

  @Get(':id')
  @RequirePermission('orders.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<OrderDto> {
    return this.orders.get(tenant.organizationId, id);
  }

  @Post()
  @RequirePermission('orders.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    const { order, replayed } = await this.orders.create(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return order;
  }

  @Post(':id/payments')
  @RequirePermission('orders.manage')
  async deposit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(orderDepositSchema)) body: OrderDepositInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    const { order, replayed } = await this.orders.receiveDeposit(
      tenant,
      user,
      id,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return order;
  }

  @Post(':id/status')
  @RequirePermission('orders.manage')
  async status(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(orderStatusSchema)) body: OrderStatusInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    res.status(HttpStatus.OK);
    return this.orders.setStatus(tenant, user, id, body, requestId);
  }

  @Post(':id/deliver')
  @RequirePermission('orders.manage')
  async deliver(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(deliverOrderSchema)) body: DeliverOrderInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    const order = await this.orders.deliver(tenant, user, id, body, requestId);
    await this.alerts.flush(tenant.organizationId);
    res.status(HttpStatus.OK);
    return order;
  }

  @Post(':id/cancel')
  @RequirePermission('orders.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) body: CancelOrderInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    res.status(HttpStatus.OK);
    return this.orders.cancel(tenant, user, id, body, requestId);
  }

  // Orders sent from the storefront (ADR-075).

  @Post(':id/accept')
  @RequirePermission('orders.manage')
  async accept(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(acceptOrderSchema)) body: AcceptOrderInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    res.status(HttpStatus.OK);
    return this.orders.accept(tenant, user, id, body, requestId);
  }

  @Post(':id/reschedule')
  @RequirePermission('orders.manage')
  async reschedule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rescheduleOrderSchema))
    body: RescheduleOrderInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    res.status(HttpStatus.OK);
    return this.orders.reschedule(tenant, user, id, body, requestId);
  }

  @Post(':id/decline')
  @RequirePermission('orders.cancel')
  async decline(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(declineOrderSchema)) body: DeclineOrderInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDto> {
    res.status(HttpStatus.OK);
    return this.orders.decline(tenant, user, id, body, requestId);
  }
}
