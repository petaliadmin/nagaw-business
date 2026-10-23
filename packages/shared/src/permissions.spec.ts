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

describe('agent permissions', () => {
  it('lets every role read agents but only owners and admins manage them', () => {
    for (const role of ROLES) {
      expect(roleHasPermission(role, 'agents.read')).toBe(true);
    }
    expect(roleHasPermission('owner', 'agents.manage')).toBe(true);
    expect(roleHasPermission('admin', 'agents.manage')).toBe(true);
    expect(roleHasPermission('member', 'agents.manage')).toBe(false);
    expect(roleHasPermission('viewer', 'agents.manage')).toBe(false);
  });
});
