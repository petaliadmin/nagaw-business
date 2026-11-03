import { formatAccountPhone, type Role } from '@nagaw/shared';
import type { Request } from 'express';

export interface AuthContext {
  userId: string;
  email: string | null;
  /** International digits of a phone account (ADR-058). */
  phone: string | null;
}

/** How a person is named in a message: number, e-mail, or neither. */
export function userLabel(user: AuthContext): string {
  if (user.phone) return formatAccountPhone(user.phone);
  return user.email ?? 'un vendeur';
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
