import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  createOrganizationSchema,
  SHOP_MARKS,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type MemberDto,
  type OrganizationDto,
  type OrganizationWithRoleDto,
  type ShopMarkKind,
  type UpdateOrganizationInput,
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
import { OrganizationsService } from './organizations.service.js';

const markKindSchema = z.enum(SHOP_MARKS);

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /** Not tenant-scoped: any authenticated user may create an organization. */
  @Post()
  create(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createOrganizationSchema))
    body: CreateOrganizationInput,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationWithRoleDto> {
    return this.organizations.create(user, body, requestId);
  }

  @Get('current')
  @RequirePermission('organization.read')
  current(@CurrentTenant() tenant: TenantContext): Promise<OrganizationDto> {
    return this.organizations.get(tenant.organizationId);
  }

  @Patch('current')
  @RequirePermission('organization.update')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(updateOrganizationSchema))
    body: UpdateOrganizationInput,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.organizations.update(
      tenant.organizationId,
      user,
      body,
      requestId,
    );
  }

  @Get('current/logo')
  @RequirePermission('organization.read')
  async logo(
    @CurrentTenant() tenant: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const logo = await this.organizations.logo(tenant.organizationId);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('ETag', `"${logo.sha256}"`);
    return new StreamableFile(logo.data, { type: logo.contentType });
  }

  /** Raw image body (PNG or JPEG), resized on the device. */
  @Put('current/logo')
  @RequirePermission('organization.update')
  setLogo(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.organizations.setLogo(
      tenant.organizationId,
      user,
      contentType,
      body,
      requestId,
    );
  }

  @Delete('current/logo')
  @RequirePermission('organization.update')
  removeLogo(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.organizations.removeLogo(
      tenant.organizationId,
      user,
      requestId,
    );
  }

  /**
   * The originals, for those who manage them only: a seller sees them on an
   * invoice, but cannot take them to sign something else (ADR-052).
   */
  @Get('current/marks/:kind')
  @RequirePermission('organization.update')
  async mark(
    @CurrentTenant() tenant: TenantContext,
    @Param('kind', new ZodValidationPipe(markKindSchema)) kind: ShopMarkKind,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const mark = await this.organizations.mark(tenant.organizationId, kind);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(mark.data, { type: mark.contentType });
  }

  /** Raw image body (PNG or JPEG), resized on the device. */
  @Put('current/marks/:kind')
  @RequirePermission('organization.update')
  setMark(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('kind', new ZodValidationPipe(markKindSchema)) kind: ShopMarkKind,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.organizations.setMark(
      tenant.organizationId,
      user,
      kind,
      contentType,
      body,
      requestId,
    );
  }

  @Delete('current/marks/:kind')
  @RequirePermission('organization.update')
  removeMark(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('kind', new ZodValidationPipe(markKindSchema)) kind: ShopMarkKind,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.organizations.removeMark(
      tenant.organizationId,
      user,
      kind,
      requestId,
    );
  }

  @Get('current/members')
  @RequirePermission('members.read')
  members(@CurrentTenant() tenant: TenantContext): Promise<MemberDto[]> {
    return this.organizations.listMembers(tenant.organizationId);
  }
}
