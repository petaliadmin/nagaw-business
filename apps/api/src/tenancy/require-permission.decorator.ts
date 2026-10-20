import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@nagaw/shared';

export const REQUIRED_PERMISSION = 'tenancy:permission';

/**
 * Marks a route as tenant-scoped: the caller must be an active member of the
 * organization named by `X-Organization-Id` and hold this permission.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
