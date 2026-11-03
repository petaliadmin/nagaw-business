'use client';

import type { CustomerDto } from '@nagaw/shared';
import {
  ChevronRight,
  FilePlus2,
  MessageCircle,
  Phone,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import {
  ACTION_ROW as ACTION,
  ActionIcon,
  SaveContactButton,
} from '@/components/contacts/contact-actions';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import { creditReminderText, whatsappLink } from '@/lib/sales/ticket';
import { archiveCustomer } from '../vendre/actions';

/** Asks before removing: one touch too many must not lose a customer. */
function ArchiveForm({
  organizationId,
  customer,
  onCancel,
}: {
  organizationId: string;
  customer: CustomerDto;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    archiveCustomer,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="customerId" value={customer.id} />
      <FormMessage state={state} />
      <p className="text-lg font-bold">
        Supprimer {customer.name} de vos clients ?
      </p>
      <p className="text-ink-muted">
        Ses ventes et ses factures restent enregistrées.
      </p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton variant="danger" pendingLabel="Suppression…">
          Oui, supprimer
        </SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses('secondary')}
        >
          Non, garder
        </button>
      </div>
    </ActionForm>
  );
}

/**
 * What « ⋮ » offers on a customer, in colours. Loaded when the sheet opens,
 * so that the list stays light (performance budget).
 */
export function CustomerActions({
  customer,
  organizationId,
  shopName,
  countryCode,
  owed,
  canManage,
  canDocument,
}: {
  customer: CustomerDto;
  organizationId: string;
  shopName: string;
  countryCode: string;
  owed: string | null;
  canManage: boolean;
  canDocument: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const href = `/espace/clients/${customer.id}`;
  if (confirming)
    return (
      <ArchiveForm
        organizationId={organizationId}
        customer={customer}
        onCancel={() => setConfirming(false)}
      />
    );
  return (
    <div className="flex flex-col gap-3">
      {customer.phone && (
        <>
          <a
            href={`tel:${customer.phone.replace(/\s/g, '')}`}
            className={ACTION}
          >
            <ActionIcon icon={Phone} tone="brand" />
            Appeler le {customer.phone}
          </a>
          {canManage && owed && (
            <a
              href={whatsappLink(
                creditReminderText(customer.name, shopName, owed),
                customer.phone,
                countryCode,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={ACTION}
            >
              <ActionIcon icon={MessageCircle} tone="sales" />
              Relancer sur WhatsApp
            </a>
          )}
          <SaveContactButton
            person={customer}
            countryCode={countryCode}
            tone="stock"
          />
        </>
      )}
      {canDocument && (
        <Link
          href={`/espace/factures/nouvelle?client=${customer.id}`}
          className={ACTION}
        >
          <ActionIcon icon={FilePlus2} tone="invoices" />
          Faire une facture
        </Link>
      )}
      <Link href={href} className={ACTION}>
        <ActionIcon icon={ChevronRight} tone="stats" />
        Voir la fiche du client
      </Link>
      {canManage &&
        (owed ? (
          <p className="text-ink-muted">
            Pour supprimer ce client, enregistrez d’abord son remboursement : il
            vous doit encore {owed}.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${ACTION} text-danger-ink`}
          >
            <ActionIcon icon={Trash2} tone="danger" />
            Supprimer le client
          </button>
        ))}
    </div>
  );
}
