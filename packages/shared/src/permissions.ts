import { z } from 'zod';

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/**
 * Permissions checked by the API on every tenant-scoped operation. The UI
 * may use the same map to hide actions, but hiding is never the control.
 */
export const PERMISSIONS = [
  'organization.read',
  'organization.update',
  'members.read',
  'members.invite',
  'members.manage',
  'audit.read',
  'catalog.read',
  'catalog.manage',
  'stock.move',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.invite',
    'members.manage',
    'audit.read',
    'catalog.read',
    'catalog.manage',
    'stock.move',
  ],
  admin: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.invite',
    'members.manage',
    'audit.read',
    'catalog.read',
    'catalog.manage',
    'stock.move',
  ],
  // Sellers see the catalogue and the stock; managing them is the manager's
  // job (docs/ARCHITECTURE.md § 5).
  member: ['organization.read', 'members.read', 'catalog.read'],
  viewer: ['organization.read', 'members.read', 'catalog.read'],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
