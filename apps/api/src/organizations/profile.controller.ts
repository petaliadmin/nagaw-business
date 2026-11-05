import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  saveShopProfileSchema,
  updateShopModulesSchema,
  type OrganizationDto,
  type SaveShopProfileInput,
  type ShopProfileDto,
  type UpdateShopModulesInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { ProfileService } from './profile.service.js';

/** Profile of the shop and its menu (ADR-062): owner and managers. */
@Controller('organizations/current')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('profile')
  @RequirePermission('organization.update')
  get(@CurrentTenant() tenant: TenantContext): Promise<ShopProfileDto> {
    return this.profile.get(tenant.organizationId);
  }

  @Put('profile')
  @RequirePermission('organization.update')
  save(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(saveShopProfileSchema))
    body: SaveShopProfileInput,
    @RequestId() requestId: string | null,
  ): Promise<ShopProfileDto> {
    return this.profile.save(tenant.organizationId, user, body, requestId);
  }

  @Post('profile/skip')
  @RequirePermission('organization.update')
  skip(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.profile.skip(tenant.organizationId, user, requestId);
  }

  @Put('modules')
  @RequirePermission('organization.update')
  modules(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(updateShopModulesSchema))
    body: UpdateShopModulesInput,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.profile.updateModules(
      tenant.organizationId,
      user,
      body,
      requestId,
    );
  }
}
