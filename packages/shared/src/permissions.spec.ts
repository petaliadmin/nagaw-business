import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, roleHasPermission } from './permissions.js';

describe('roleHasPermission', () => {
  it('grants every permission to owners', () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission('owner', permission)).toBe(true);
    }
  });

  it('keeps organization updates and audit reading away from members and viewers', () => {
    for (const role of ['member', 'viewer'] as const) {
      expect(roleHasPermission(role, 'organization.update')).toBe(false);
      expect(roleHasPermission(role, 'audit.read')).toBe(false);
    }
  });

  it('lets every role read its organization', () => {
    for (const role of ROLES) {
      expect(roleHasPermission(role, 'organization.read')).toBe(true);
    }
  });
});

describe('member management permissions', () => {
  it('lets only owners and admins invite and manage members', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(roleHasPermission(role, 'members.invite')).toBe(true);
      expect(roleHasPermission(role, 'members.manage')).toBe(true);
    }
    for (const role of ['member', 'viewer'] as const) {
      expect(roleHasPermission(role, 'members.invite')).toBe(false);
      expect(roleHasPermission(role, 'members.manage')).toBe(false);
    }
  });
});

describe('seller access (ADR-036)', () => {
  it('lets sellers receive goods, correct the stock at the counter and prepare quotes', () => {
    for (const permission of [
      'stock.receive',
      'stock.correct',
      'documents.read',
      'quotes.manage',
    ] as const)
      expect(roleHasPermission('member', permission)).toBe(true);
  });

  it('keeps losses, inventories, invoices and the money away from sellers', () => {
    for (const permission of [
      'stock.move',
      'catalog.manage',
      'documents.manage',
      'sales.cancel',
      'sales.read_all',
      'stats.read',
      'treasury.read',
    ] as const)
      expect(roleHasPermission('member', permission)).toBe(false);
  });

  it('keeps the accountant read-only', () => {
    for (const permission of [
      'stock.receive',
      'stock.correct',
      'quotes.manage',
    ] as const)
      expect(roleHasPermission('viewer', permission)).toBe(false);
  });
});
