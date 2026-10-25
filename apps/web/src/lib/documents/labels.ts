import type {
  DocumentListItemDto,
  InvoicePaymentMethod,
  InvoicePaymentState,
  QuoteStatus,
} from '@nagaw/shared';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
};

export const INVOICE_PAYMENT_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  bank_transfer: 'Virement',
  cheque: 'Chèque',
};

const PAYMENT_STATE_LABELS: Record<InvoicePaymentState, string> = {
  unpaid: 'À payer',
  partially_paid: 'Payée en partie',
  paid: 'Payée',
};

/** One badge per document, in everyday words. */
export function documentBadge(doc: {
  kind: DocumentListItemDto['kind'];
  status: DocumentListItemDto['status'];
  paymentState: InvoicePaymentState | null;
  expired: boolean;
  overdue: boolean;
}): { label: string; tone: Tone } {
  if (doc.kind === 'quote') {
    if (doc.expired) return { label: 'Expiré', tone: 'warning' };
    const status = doc.status as QuoteStatus;
    return {
      label: QUOTE_STATUS_LABELS[status],
      tone:
        status === 'accepted'
          ? 'success'
          : status === 'refused'
            ? 'danger'
            : status === 'sent'
              ? 'brand'
              : 'neutral',
    };
  }
  if (doc.kind === 'credit_note') return { label: 'Avoir', tone: 'neutral' };
  if (doc.status === 'draft') return { label: 'Brouillon', tone: 'neutral' };
  if (doc.status === 'cancelled') return { label: 'Annulée', tone: 'danger' };
  if (doc.overdue) return { label: 'En retard', tone: 'danger' };
  const state = doc.paymentState ?? 'unpaid';
  return {
    label: PAYMENT_STATE_LABELS[state],
    tone:
      state === 'paid'
        ? 'success'
        : state === 'partially_paid'
          ? 'warning'
          : 'brand',
  };
}

/** Title of a document, a draft invoice having no number yet. */
export function documentTitle(doc: {
  kind: DocumentListItemDto['kind'];
  number: string | null;
}): string {
  const word =
    doc.kind === 'quote'
      ? 'Devis'
      : doc.kind === 'credit_note'
        ? 'Avoir'
        : 'Facture';
  return doc.number ? `${word} ${doc.number}` : `${word} (brouillon)`;
}
