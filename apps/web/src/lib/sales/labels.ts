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
  free_money: 'Free Money',
  other: 'Autre',
};

/** `Ticket n° 000042`: same width on every ticket. */
export function ticketNumber(saleNumber: number): string {
  return `n° ${String(saleNumber).padStart(6, '0')}`;
}
