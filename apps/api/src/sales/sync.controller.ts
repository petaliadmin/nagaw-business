import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  registerDeviceSchema,
  syncRequestSchema,
  type DeviceDto,
  type RegisterDeviceInput,
  type SyncRequest,
  type SyncResponseDto,
} from '@nagaw/shared';
import type { Response } from 'express';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { DevicesService } from './devices.service.js';
import { SyncService } from './sync.service.js';

/** Devices and offline synchronization (ADR-020). */
@Controller()
export class SyncController {
  constructor(
    private readonly devices: DevicesService,
    private readonly sync: SyncService,
  ) {}

  @Get('devices')
  @RequirePermission('sales.create')
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
  ): Promise<DeviceDto[]> {
    return this.devices.list(tenant, user);
  }

  @Post('devices')
  @RequirePermission('sales.create')
  async register(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(registerDeviceSchema))
    body: RegisterDeviceInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeviceDto> {
    const { device, replayed } = await this.devices.register(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return device;
  }

  @Post('devices/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devices.manage')
  revoke(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<DeviceDto> {
    return this.devices.revoke(tenant, user, id, requestId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.create')
  apply(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(syncRequestSchema)) body: SyncRequest,
    @RequestId() requestId: string | null,
  ): Promise<SyncResponseDto> {
    return this.sync.apply(tenant, user, body, requestId);
  }
}
