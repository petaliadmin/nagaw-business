import type { InvitationStatus, MemberStatus, Role } from '@nagaw/shared';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.created': 'Organisation créée',
  'organization.updated': 'Paramètres de l’organisation modifiés',
  'invitation.created': 'Invitation créée',
  'invitation.revoked': 'Invitation annulée',
  'invitation.accepted': 'Invitation acceptée',
  'member.role_changed': 'Rôle d’un membre modifié',
  'member.disabled': 'Membre désactivé',
  'member.reactivated': 'Membre réactivé',
};

/** Human label for an audit action; unknown actions show their raw key. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Actif',
  disabled: 'Désactivé',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  revoked: 'Annulée',
  expired: 'Expirée',
};
