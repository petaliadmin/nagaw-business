import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import {
  createUnitTemplateSchema,
  updateUnitTemplateSchema,
  type CreateUnitTemplateInput,
  type UnitTemplateDto,
  type UpdateUnitTemplateInput,
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
import { UnitTemplatesService } from './unit-templates.service.js';

/** Unit templates of the shop (ADR-038). */
@Controller('unit-templates')
export class UnitTemplatesController {
  constructor(private readonly templates: UnitTemplatesService) {}

  @Get()
  @RequirePermission('catalog.read')
  list(@CurrentTenant() tenant: TenantContext): Promise<UnitTemplateDto[]> {
    return this.templates.list(tenant.organizationId);
  }

  @Post()
  @RequirePermission('catalog.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createUnitTemplateSchema))
    body: CreateUnitTemplateInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UnitTemplateDto> {
    const { template, replayed } = await this.templates.create(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return template;
  }

  @Patch(':id')
  @RequirePermission('catalog.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUnitTemplateSchema))
    body: UpdateUnitTemplateInput,
    @RequestId() requestId: string | null,
  ): Promise<UnitTemplateDto> {
    return this.templates.update(tenant, user, id, body, requestId);
  }
}
