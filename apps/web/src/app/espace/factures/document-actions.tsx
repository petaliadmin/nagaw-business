'use client';

import {
  amountInputValue,
  INVOICE_PAYMENT_METHODS,
  MOBILE_MONEY_PROVIDERS,
} from '@nagaw/shared';
import { Share2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { INVOICE_PAYMENT_LABELS } from '@/lib/documents/labels';
import { PROVIDER_LABELS } from '@/lib/sales/labels';
import {
  addInvoicePayment,
  cancelInvoice,
  changeQuoteStatus,
  invoiceFromQuote,
  invoiceFromSale,
  issueInvoice,
} from './actions';

export function IssueInvoiceForm({
  organizationId,
  invoiceId,
}: {
  organizationId: string;
  invoiceId: string;
}) {
  const [state, action, pending] = useActionState(
    issueInvoice,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Émission…">Émettre la facture</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PaymentForm({
  organizationId,
  invoiceId,
  currency,
  balance,
  today,
}: {
  organizationId: string;
  invoiceId: string;
  currency: string;
  balance: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(
    addInvoicePayment,
    initialFormState,
  );
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [method, setMethod] = useState('cash');
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') setOperationId(crypto.randomUUID());
  }
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      key={operationId}
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Montant reçu"
          name="amount"
          id="pay-amount"
          inputMode="decimal"
          defaultValue={amountInputValue(balance, currency)}
          required
          error={errors.amount}
        />
        <FormField
          label="Reçu le"
          name="paidOn"
          id="pay-date"
          type="date"
          defaultValue={today}
          required
          error={errors.paidOn}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-method" className="text-base font-semibold">
            Payé en
          </label>
          <select
            id="pay-method"
            name="method"
            value={method}
            onChange={(event) => setMethod(event.currentTarget.value)}
            className="min-h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-2 text-base text-ink"
          >
            {INVOICE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {INVOICE_PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        {method === 'mobile_money' && (
          <SelectField
            label="Opérateur"
            name="provider"
            id="pay-provider"
            defaultValue="wave"
            options={MOBILE_MONEY_PROVIDERS.map((p) => ({
              value: p,
              label: PROVIDER_LABELS[p],
            }))}
            error={errors.provider}
          />
        )}
        <FormField
          label="Référence : n° de transaction, de chèque… (facultatif)"
          name="reference"
          id="pay-reference"
          maxLength={60}
          error={errors.reference}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer le paiement
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CancelInvoiceForm({
  organizationId,
  invoiceId,
}: {
  organizationId: string;
  invoiceId: string;
}) {
  const [state, action, pending] = useActionState(
    cancelInvoice,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <FormField
        label="Pourquoi annuler cette facture ?"
        name="reason"
        id="cancel-reason"
        maxLength={500}
        required
        placeholder="Erreur de montant, commande annulée…"
        error={state.fieldErrors?.reason}
      />
      <div>
        <SubmitButton variant="danger" pendingLabel="Annulation…">
          Annuler par un avoir
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

const STATUS_BUTTONS = {
  sent: { label: 'Marquer comme envoyé', variant: 'secondary' },
  accepted: { label: 'Le client accepte', variant: 'primary' },
  refused: { label: 'Le client refuse', variant: 'danger' },
} as const;

export function QuoteStatusForm({
  organizationId,
  quoteId,
  next,
}: {
  organizationId: string;
  quoteId: string;
  next: ('sent' | 'accepted' | 'refused')[];
}) {
  const [state, action, pending] = useActionState(
    changeQuoteStatus,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        {next.map((status) => (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            disabled={pending}
            className={buttonClasses(STATUS_BUTTONS[status].variant)}
          >
            {STATUS_BUTTONS[status].label}
          </button>
        ))}
      </div>
    </ActionForm>
  );
}

export function InvoiceFromQuoteForm({
  organizationId,
  quoteId,
}: {
  organizationId: string;
  quoteId: string;
}) {
  const [state, action, pending] = useActionState(
    invoiceFromQuote,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Préparation…">
          Faire la facture de ce devis
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Invoice of a sale paid at the counter; asks the customer if it had none. */
export function InvoiceFromSaleForm({
  organizationId,
  saleId,
  customers,
}: {
  organizationId: string;
  saleId: string;
  /** Null when the sale already names its customer. */
  customers: { id: string; name: string }[] | null;
}) {
  const [state, action, pending] = useActionState(
    invoiceFromSale,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      {customers &&
        (customers.length === 0 ? (
          <Alert>
            Ajoutez d’abord le client dans la page Clients : une facture porte
            toujours le nom du client.
          </Alert>
        ) : (
          <SelectField
            label="Facture au nom de"
            name="customerId"
            id="sale-invoice-customer"
            defaultValue=""
            options={[
              { value: '', label: 'Choisir le client' },
              ...customers.map((c) => ({ value: c.id, label: c.name })),
            ]}
            error={state.fieldErrors?.customerId}
          />
        ))}
      <div>
        <SubmitButton pendingLabel="Préparation…">
          Faire une facture
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Sends the PDF with the phone's share sheet (WhatsApp, e-mail…) when the
 * browser can share files; otherwise opens it, to save or print.
 */
export function SharePdfButton({
  href,
  fileName,
}: {
  href: string;
  fileName: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function share() {
    setMessage(null);
    setBusy(true);
    try {
      const response = await fetch(href);
      if (!response.ok) {
        setMessage('Le PDF n’a pas pu être préparé. Réessayez.');
        return;
      }
      const file = new File([await response.blob()], `${fileName}.pdf`, {
        type: 'application/pdf',
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        window.open(href, '_blank', 'noopener');
      }
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage('Le partage a échoué : ouvrez le PDF pour l’envoyer.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className={buttonClasses('secondary')}
      >
        <Share2 aria-hidden className="size-5" />
        {busy ? 'Préparation…' : 'Envoyer le PDF'}
      </button>
      {message && <Alert tone="error">{message}</Alert>}
    </div>
  );
}
