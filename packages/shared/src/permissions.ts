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
  'stock.receive',
  'stock.correct',
  'sales.create',
  'sales.read',
  'sales.read_all',
  'sales.cancel',
  'customers.read',
  'customers.manage',
  'devices.manage',
  'documents.read',
  'documents.manage',
  'quotes.manage',
  'stats.read',
  'treasury.read',
  'treasury.manage',
  'accounting.read',
  'subscription.read',
  'subscription.manage',
  'feedback.send',
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
    'stock.receive',
    'stock.correct',
    'sales.create',
    'sales.read',
    'sales.read_all',
    'sales.cancel',
    'customers.read',
    'customers.manage',
    'devices.manage',
    'documents.read',
    'documents.manage',
    'quotes.manage',
    'stats.read',
    'treasury.read',
    'treasury.manage',
    'accounting.read',
    'subscription.read',
    'subscription.manage',
    'feedback.send',
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
    'stock.receive',
    'stock.correct',
    'sales.create',
    'sales.read',
    'sales.read_all',
    'sales.cancel',
    'customers.read',
    'customers.manage',
    'devices.manage',
    'documents.read',
    'documents.manage',
    'quotes.manage',
    'stats.read',
    'treasury.read',
    'treasury.manage',
    'accounting.read',
    'subscription.read',
    'feedback.send',
  ],
  // Sellers see the catalogue and the stock, record deliveries and correct
  // the stock at the counter within a limit set by the shop (ADR-036);
  // losses, inventories and the catalogue stay the manager's job. They
  // sell, see their own sales and figures, serve customers (credit,
  // repayments), read invoices and prepare quotes; issuing invoices and
  // cancelling a sale are for managers.
  member: [
    'organization.read',
    'members.read',
    'catalog.read',
    'stock.receive',
    'stock.correct',
    'sales.create',
    'sales.read',
    'customers.read',
    'customers.manage',
    'documents.read',
    'quotes.manage',
    'feedback.send',
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
    'feedback.send',
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
