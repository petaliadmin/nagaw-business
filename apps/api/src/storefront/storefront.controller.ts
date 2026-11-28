import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import {
  storefrontArticlesSchema,
  updateStorefrontSchema,
  type StorefrontArticleSettingDto,
  type StorefrontArticlesInput,
  type StorefrontSettingsDto,
  type UpdateStorefrontInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { StorefrontService } from './storefront.service.js';

/** Ma vitrine, the shop's settings (ADR-075): owner and managers. */
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get()
  @RequirePermission('orders.read')
  settings(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<StorefrontSettingsDto> {
    return this.storefront.settings(tenant.organizationId);
  }

  @Patch()
  @RequirePermission('storefront.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(updateStorefrontSchema))
    body: UpdateStorefrontInput,
    @RequestId() requestId: string | null,
  ): Promise<StorefrontSettingsDto> {
    return this.storefront.update(tenant, user, body, requestId);
  }

  @Get('articles')
  @RequirePermission('storefront.manage')
  articles(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<StorefrontArticleSettingDto[]> {
    return this.storefront.articles(tenant.organizationId);
  }

  @Put('articles')
  @RequirePermission('storefront.manage')
  setArticles(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(storefrontArticlesSchema))
    body: StorefrontArticlesInput,
    @RequestId() requestId: string | null,
  ): Promise<StorefrontArticleSettingDto[]> {
    return this.storefront.setArticles(tenant, user, body, requestId);
  }
}
