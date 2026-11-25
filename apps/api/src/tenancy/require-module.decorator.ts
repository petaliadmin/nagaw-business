import { SetMetadata } from '@nestjs/common';
import type { PlanModule } from '@nagaw/shared';

export const REQUIRED_MODULE = 'tenancy:module';

/**
 * Marks a route of a module an offer may leave out (ADR-075): the shop's
 * offer must include it, checked by `TenantGuard` with the permission.
 */
export const RequireModule = (module: PlanModule) =>
  SetMetadata(REQUIRED_MODULE, module);
