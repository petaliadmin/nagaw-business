import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createInvitationSchema,
  invitationTokenBodySchema,
  updateMemberSchema,
  type CreateInvitationInput,
  type CreatedInvitationDto,
  type InvitationDto,
  type InvitationPreviewDto,
  type InvitationTokenBody,
  type MemberDto,
  type OrganizationWithRoleDto,
  type UpdateMemberInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { InvitationsService } from './invitations.service.js';
import { MembersService } from './members.service.js';

@Controller('organizations/current')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly invitations: InvitationsService,
  ) {}

  @Patch('members/:userId')
  @RequirePermission('members.manage')
  updateMember(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) body: UpdateMemberInput,
    @RequestId() requestId: string | null,
  ): Promise<MemberDto> {
    return this.members.update(tenant, user, userId, body, requestId);
  }

  @Get('invitations')
  @RequirePermission('members.invite')
  listInvitations(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<InvitationDto[]> {
    return this.invitations.listPending(tenant.organizationId);
  }

  @Post('invitations')
  @RequirePermission('members.invite')
  createInvitation(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createInvitationSchema))
    body: CreateInvitationInput,
    @RequestId() requestId: string | null,
  ): Promise<CreatedInvitationDto> {
    return this.invitations.create(tenant, user, body, requestId);
  }

  @Post('invitations/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('members.invite')
  revokeInvitation(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<InvitationDto> {
    return this.invitations.revoke(tenant, user, id, requestId);
  }
}

/**
 * Invitee side: not tenant-scoped (the invitee is not a member yet). The
 * token travels in the body, never in the URL, so it stays out of logs.
 */
@Controller('invitations')
export class InvitationAcceptanceController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(invitationTokenBodySchema))
    body: InvitationTokenBody,
  ): Promise<InvitationPreviewDto> {
    return this.invitations.preview(user, body.token);
  }

  @Post('accept')
  accept(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(invitationTokenBodySchema))
    body: InvitationTokenBody,
    @RequestId() requestId: string | null,
  ): Promise<OrganizationWithRoleDto> {
    return this.invitations.accept(user, body.token, requestId);
  }
}
