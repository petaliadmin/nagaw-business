'use client';

import { Printer } from 'lucide-react';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { TicketActionButton } from '@/components/ui/ticket-action';
import { initialFormState } from '@/lib/auth/form-state';
import { cancelSale } from '../../vendre/actions';

/**
 * Prints the ticket page with the system print dialog (58 mm layout). It
 * works with any printer the phone or computer knows; direct Bluetooth
 * printing (ADR-022) needs tests on real printers first.
 */
export function PrintButton() {
  return (
    <TicketActionButton
      icon={Printer}
      verb="Imprimer"
      rest="le ticket"
      onClick={() => window.print()}
    />
  );
}

export function CancelSaleForm({
  organizationId,
  saleId,
}: {
  organizationId: string;
  saleId: string;
}) {
  const [state, action, pending] = useActionState(cancelSale, initialFormState);
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="saleId" value={saleId} />
      <FormMessage state={state} />
      <FormField
        label="Pourquoi annuler cette vente ?"
        name="reason"
        maxLength={500}
        required
        placeholder="Erreur de saisie, client qui rend les articles…"
        error={state.fieldErrors?.reason}
      />
      <div>
        <SubmitButton variant="danger" pendingLabel="Annulation…">
          Annuler la vente
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
