import { Controller, Get, Query } from '@nestjs/common';
import {
  paginationQuerySchema,
  type AuditLogDto,
  type Paginated,
  type PaginationQuery,
} from '@nagaw/shared';
import type { TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentTenant } from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { AuditService } from './audit.service.js';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<AuditLogDto>> {
    return this.audit.list(tenant.organizationId, query.limit, query.cursor);
  }
}
