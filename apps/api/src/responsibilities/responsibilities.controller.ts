import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  changeResponsibilityStatusSchema,
  createResponsibilitySchema,
  updateResponsibilitySchema,
  type CreateResponsibilityInput,
  type ResponsibilityDto,
  type ResponsibilityHistoryEntryDto,
  type ResponsibilityLimitsCaps,
  type ResponsibilityStatus,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { ResponsibilitiesService } from './responsibilities.service.js';

@Controller('responsibilities')
export class ResponsibilitiesController {
  constructor(private readonly responsibilities: ResponsibilitiesService) {}

  @Get()
  @RequirePermission('responsibilities.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('agentId') agentId?: string,
    @Query('archives') archives?: string,
  ): Promise<ResponsibilityDto[]> {
    return this.responsibilities.list(tenant.organizationId, {
      agentId,
      includeArchived: archives === 'true',
    });
  }

  @Get('limits')
  @RequirePermission('responsibilities.read')
  async limits(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<ResponsibilityLimitsCaps> {
    const { maxResponsibilities, maxRunsPerDay } =
      await this.responsibilities.caps(tenant.organizationId);
    return { maxResponsibilities, maxRunsPerDay };
  }

  @Post()
  @RequirePermission('responsibilities.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createResponsibilitySchema))
    body: CreateResponsibilityInput,
    @RequestId() requestId: string | null,
  ): Promise<ResponsibilityDto> {
    return this.responsibilities.create(tenant, user, body, requestId);
  }

  @Get(':id')
  @RequirePermission('responsibilities.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ResponsibilityDto> {
    return this.responsibilities.get(tenant.organizationId, id);
  }

  /** Replaces the editable fields; the status has its own endpoint. */
  @Put(':id')
  @RequirePermission('responsibilities.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateResponsibilitySchema))
    body: CreateResponsibilityInput,
    @RequestId() requestId: string | null,
  ): Promise<ResponsibilityDto> {
    return this.responsibilities.update(tenant, user, id, body, requestId);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('responsibilities.manage')
  changeStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeResponsibilityStatusSchema))
    body: { status: ResponsibilityStatus },
    @RequestId() requestId: string | null,
  ): Promise<ResponsibilityDto> {
    return this.responsibilities.changeStatus(
      tenant,
      user,
      id,
      body.status,
      requestId,
    );
  }

  @Get(':id/history')
  @RequirePermission('responsibilities.read')
  history(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ResponsibilityHistoryEntryDto[]> {
    return this.responsibilities.history(tenant.organizationId, id);
  }
}
