import type { CashAccountDto, CashMovementKind } from '@nagaw/shared';

export const MOVEMENT_LABELS: Record<CashMovementKind, string> = {
  sale: 'Vente',
  sale_cancelled: 'Vente annulée',
  repayment: 'Remboursement de',
  invoice_payment: 'Paiement de la facture',
  expense: 'Dépense',
  transfer_in: 'Reçu de',
  transfer_out: 'Envoyé vers',
  closing: 'Écart de clôture',
};

/** « Vente n° 000042 », « Dépense : Loyer »… in everyday words. */
export function movementLabel(kind: CashMovementKind, label: string): string {
  switch (kind) {
    case 'sale':
    case 'sale_cancelled':
      return `${MOVEMENT_LABELS[kind]} n° ${label}`;
    case 'expense':
      return `Dépense : ${label}`;
    case 'closing':
      return label ? `Écart de clôture (${label})` : 'Écart de clôture';
    default:
      return `${MOVEMENT_LABELS[kind]} ${label}`.trim();
  }
}

/** Accounts as select options, cash drawer first. */
export function accountOptions(
  accounts: Pick<CashAccountDto, 'id' | 'name'>[],
) {
  return accounts.map((a) => ({ value: a.id, label: a.name }));
}
