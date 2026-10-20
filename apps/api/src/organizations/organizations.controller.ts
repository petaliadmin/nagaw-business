import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type MemberDto,
  type OrganizationDto,
  type OrganizationWithRoleDto,
  type UpdateOrganizationInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { OrganizationsService } from './organizations.service.js';

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

  @Get('current/members')
  @RequirePermission('members.read')
  members(@CurrentTenant() tenant: TenantContext): Promise<MemberDto[]> {
    return this.organizations.listMembers(tenant.organizationId);
  }
}
