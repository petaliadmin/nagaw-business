import type { Role } from '@nagaw/shared';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.created': 'Organisation créée',
  'organization.updated': 'Paramètres de l’organisation modifiés',
};

/** Human label for an audit action; unknown actions show their raw key. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const MEMBER_STATUS_LABELS: Record<'active' | 'disabled', string> = {
  active: 'Actif',
  disabled: 'Désactivé',
};
