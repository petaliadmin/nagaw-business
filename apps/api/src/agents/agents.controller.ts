import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  agentConfigurationSchema,
  changeAgentStatusSchema,
  createAgentSchema,
  updateAgentSchema,
  type AgentConfigurationInput,
  type AgentDto,
  type AgentLimitsCaps,
  type AgentTestReportDto,
  type AgentVersionDto,
  type ChangeAgentStatusInput,
  type CreateAgentInput,
  type UpdateAgentInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { AgentsService } from './agents.service.js';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @RequirePermission('agents.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('archives') archives?: string,
  ): Promise<AgentDto[]> {
    return this.agents.list(tenant.organizationId, archives === 'true');
  }

  /** The organization's caps, so the interface can show them. */
  @Get('limits')
  @RequirePermission('agents.read')
  limits(@CurrentTenant() tenant: TenantContext): Promise<AgentLimitsCaps> {
    return this.agents.caps(tenant.organizationId);
  }

  @Post()
  @RequirePermission('agents.manage')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createAgentSchema)) body: CreateAgentInput,
    @RequestId() requestId: string | null,
  ): Promise<AgentDto> {
    return this.agents.create(tenant, user, body, requestId);
  }

  @Get(':id')
  @RequirePermission('agents.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<AgentDto> {
    return this.agents.get(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermission('agents.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAgentSchema)) body: UpdateAgentInput,
    @RequestId() requestId: string | null,
  ): Promise<AgentDto> {
    return this.agents.update(tenant, user, id, body, requestId);
  }

  @Get(':id/versions')
  @RequirePermission('agents.read')
  versions(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<AgentVersionDto[]> {
    return this.agents.listVersions(tenant.organizationId, id);
  }

  @Post(':id/versions')
  @RequirePermission('agents.manage')
  configure(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(agentConfigurationSchema))
    body: AgentConfigurationInput,
    @RequestId() requestId: string | null,
  ): Promise<AgentDto> {
    return this.agents.configure(tenant, user, id, body, requestId);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('agents.manage')
  changeStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeAgentStatusSchema))
    body: ChangeAgentStatusInput,
    @RequestId() requestId: string | null,
  ): Promise<AgentDto> {
    return this.agents.changeStatus(tenant, user, id, body.status, requestId);
  }

  /** Controlled test: read-only, no model is called (ADR-007). */
  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('agents.read')
  test(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<AgentTestReportDto> {
    return this.agents.test(tenant.organizationId, id);
  }
}
