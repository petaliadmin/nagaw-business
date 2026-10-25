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
  'sales.create',
  'sales.read',
  'sales.read_all',
  'sales.cancel',
  'customers.read',
  'customers.manage',
  'devices.manage',
  'documents.read',
  'documents.manage',
  'stats.read',
  'treasury.read',
  'treasury.manage',
  'accounting.read',
  'subscription.read',
  'subscription.manage',
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
    'sales.create',
    'sales.read',
    'sales.read_all',
    'sales.cancel',
    'customers.read',
    'customers.manage',
    'devices.manage',
    'documents.read',
    'documents.manage',
    'stats.read',
    'treasury.read',
    'treasury.manage',
    'accounting.read',
    'subscription.read',
    'subscription.manage',
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
    'sales.create',
    'sales.read',
    'sales.read_all',
    'sales.cancel',
    'customers.read',
    'customers.manage',
    'devices.manage',
    'documents.read',
    'documents.manage',
    'stats.read',
    'treasury.read',
    'treasury.manage',
    'accounting.read',
    'subscription.read',
  ],
  // Sellers see the catalogue and the stock (managing them is the manager's
  // job, docs/ARCHITECTURE.md § 5), sell, see their own sales and serve
  // customers (credit, repayments); cancelling a sale is for managers.
  member: [
    'organization.read',
    'members.read',
    'catalog.read',
    'sales.create',
    'sales.read',
    'customers.read',
    'customers.manage',
  ],
  // The accountant reads everything and changes nothing.
  viewer: [
    'organization.read',
    'members.read',
    'catalog.read',
    'sales.read',
    'sales.read_all',
    'customers.read',
    'documents.read',
    'stats.read',
    'treasury.read',
    'accounting.read',
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
