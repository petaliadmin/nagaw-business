import type { Role } from '@nagaw/shared';
import type { Request } from 'express';

export interface AuthContext {
  userId: string;
  email: string | null;
}

export interface TenantContext {
  organizationId: string;
  role: Role;
}

/**
 * Express request enriched by AuthGuard and TenantGuard (`id` comes from the
 * pino-http type augmentation).
 */
export interface AppRequest extends Request {
  auth?: AuthContext;
  tenant?: TenantContext;
}
