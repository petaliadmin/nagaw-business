import type {
  InvitationStatus,
  MemberStatus,
  ResponsibilityStatus,
  Role,
  TaskOutcome,
  TaskStatus,
} from '@nagaw/shared';

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

export const RESPONSIBILITY_STATUS_LABELS: Record<
  ResponsibilityStatus,
  string
> = {
  draft: 'Brouillon',
  active: 'Active',
  suspended: 'Suspendue',
  archived: 'Archivée',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  blocked: 'Bloquée',
  done: 'Terminée',
  cancelled: 'Annulée',
};

export const TASK_OUTCOME_LABELS: Record<TaskOutcome, string> = {
  achieved: 'Objectif atteint',
  partial: 'Partiellement atteint',
  not_achieved: 'Non atteint',
};
