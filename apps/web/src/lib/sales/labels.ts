import type { MobileMoneyProvider, PaymentMethod } from '@nagaw/shared';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  credit: 'À crédit',
};

export const PROVIDER_LABELS: Record<MobileMoneyProvider, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  // Free Money became Mixx by Yas (2024): both names, while people still
  // say the old one.
  free_money: 'Mixx (Free Money)',
  other: 'Autre',
};

/** `Ticket n° 000042`: same width on every ticket. */
export function ticketNumber(saleNumber: number): string {
  return `n° ${String(saleNumber).padStart(6, '0')}`;
}
