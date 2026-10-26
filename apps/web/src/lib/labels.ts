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
  'organization.suspended': 'Boutique suspendue par la plateforme',
  'organization.reactivated': 'Boutique réactivée par la plateforme',
  'tax_rate.created': 'Taxe ajoutée',
  'tax_rate.updated': 'Taxe modifiée',
  'category.created': 'Catégorie ajoutée',
  'category.updated': 'Catégorie modifiée',
  'supplier.created': 'Fournisseur ajouté',
  'supplier.updated': 'Fournisseur modifié',
  'product.created': 'Produit ajouté',
  'product.updated': 'Produit modifié',
  'product.archived': 'Produit archivé',
  'product.photo_changed': 'Photo d’un produit changée',
  'product.photo_removed': 'Photo d’un produit retirée',
  'stock.moved': 'Mouvement de stock',
  'stock.corrected': 'Stock corrigé à la caisse',
  'notification_settings.updated': 'Réglages des alertes modifiés',
  'sale.completed': 'Vente enregistrée',
  'sale.cancelled': 'Vente annulée',
  'customer.created': 'Client ajouté',
  'customer.updated': 'Client modifié',
  'customer.repaid': 'Remboursement d’un client',
  'device.registered': 'Téléphone de caisse enregistré',
  'device.revoked': 'Téléphone de caisse retiré',
  'quote.created': 'Devis créé',
  'quote.updated': 'Devis modifié',
  'quote.status_changed': 'Statut d’un devis modifié',
  'invoice.drafted': 'Facture préparée',
  'invoice.updated': 'Facture modifiée',
  'invoice.issued': 'Facture émise',
  'invoice.paid': 'Paiement d’une facture',
  'invoice.cancelled': 'Facture annulée par un avoir',
  'cash_account.updated': 'Caisse modifiée',
  'cash_transfer.created': 'Argent déplacé entre caisses',
  'cash_closing.created': 'Caisse clôturée',
  'expense_category.created': 'Catégorie de dépense ajoutée',
  'expense_category.updated': 'Catégorie de dépense modifiée',
  'expense.recorded': 'Dépense enregistrée',
  'expense.cancelled': 'Dépense annulée',
  'expense.receipt_attached': 'Justificatif d’une dépense ajouté',
  'subscription.change_requested': 'Changement d’offre demandé',
  'subscription.change_cancelled': 'Demande de changement d’offre annulée',
  'subscription.change_rejected':
    'Demande de changement d’offre refusée par la plateforme',
  'subscription.plan_changed': 'Offre changée par la plateforme',
  'feedback.sent': 'Avis envoyé à l’équipe Nagaw',
  'feedback.answered': 'Avis traité par la plateforme',
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
