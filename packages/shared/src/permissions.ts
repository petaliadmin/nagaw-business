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
  'agents.read',
  'agents.manage',
  'responsibilities.read',
  'responsibilities.manage',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.invite',
    'members.manage',
    'agents.read',
    'agents.manage',
    'responsibilities.read',
    'responsibilities.manage',
    'audit.read',
  ],
  admin: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.invite',
    'members.manage',
    'agents.read',
    'agents.manage',
    'responsibilities.read',
    'responsibilities.manage',
    'audit.read',
  ],
  member: [
    'organization.read',
    'members.read',
    'agents.read',
    'responsibilities.read',
  ],
  viewer: [
    'organization.read',
    'members.read',
    'agents.read',
    'responsibilities.read',
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
