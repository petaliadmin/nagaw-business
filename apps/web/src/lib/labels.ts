import type { InvitationStatus, MemberStatus, Role } from '@nagaw/shared';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  admin: 'Gérant',
  member: 'Vendeur',
  viewer: 'Lecteur',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'organization.created': 'Boutique créée',
  'organization.updated': 'Paramètres de la boutique modifiés',
  'invitation.created': 'Invitation créée',
  'invitation.revoked': 'Invitation annulée',
  'invitation.accepted': 'Invitation acceptée',
  'member.role_changed': 'Rôle d’une personne modifié',
  'member.disabled': 'Accès d’une personne désactivé',
  'member.reactivated': 'Accès d’une personne réactivé',
  'agent.created': 'Agent créé',
  'agent.updated': 'Agent renommé ou décrit',
  'agent.configured': 'Configuration d’un agent modifiée',
  'agent.status_changed': 'Statut d’un agent modifié',
  'responsibility.created': 'Responsabilité créée',
  'responsibility.updated': 'Responsabilité modifiée',
  'responsibility.status_changed': 'Statut d’une responsabilité modifié',
  'task.created': 'Tâche lancée',
  'task.updated': 'Tâche modifiée',
  'task.status_changed': 'Statut d’une tâche modifié',
  'task.note_added': 'Note ajoutée à une tâche',
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
