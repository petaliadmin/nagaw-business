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

/**
 * « Espèces », « Mobile Money (Wave) », « Avance, Espèces » for a deposit
 * of the order received before the handover (ADR-072).
 */
export function paymentLabel(payment: {
  method: PaymentMethod;
  provider: MobileMoneyProvider | null;
  fromOrder?: boolean;
}): string {
  const provider = payment.provider
    ? ` (${PROVIDER_LABELS[payment.provider]})`
    : '';
  const label = `${PAYMENT_LABELS[payment.method]}${provider}`;
  return payment.fromOrder ? `Avance, ${label}` : label;
}
