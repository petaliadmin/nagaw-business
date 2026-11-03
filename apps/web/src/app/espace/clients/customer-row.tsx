'use client';

import type { CustomerDto } from '@nagaw/shared';
import {
  ChevronRight,
  EllipsisVertical,
  FilePlus2,
  MessageCircle,
  Phone,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import { creditReminderText, whatsappLink } from '@/lib/sales/ticket';
import { archiveCustomer } from '../vendre/actions';
import {
  ACTION_ROW as ACTION,
  ActionIcon,
  ContactAvatar,
  SaveContactButton,
} from '@/components/contacts/contact-actions';

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
 * One customer of the list: avatar, name and what they owe open the card;
 * « ⋮ » opens the actions on this customer in a sheet.
 */
export function CustomerRow({
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
  /** What the customer owes, formatted; null when nothing. */
  owed: string | null;
  canManage: boolean;
  canDocument: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sheetId = useId();
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  const href = `/espace/clients/${customer.id}`;

  return (
    // One card: the link fills it, « ⋮ » sits discreetly at its end.
    <li className="flex items-center rounded-2xl border border-line bg-surface pr-1">
      <Link
        href={href}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl py-3 pl-3 md:pl-4"
      >
        <ContactAvatar person={customer} />
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="flex min-w-0 flex-col">
            <span className="font-bold break-words">{customer.name}</span>
            {customer.phone && (
              <span className="text-ink-muted">{customer.phone}</span>
            )}
          </span>
          {owed ? (
            <Badge tone="warning">Doit {owed}</Badge>
          ) : (
            <Badge tone="success">Ne doit rien</Badge>
          )}
        </span>
      </Link>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        aria-label={`Plus d’actions pour ${customer.name}`}
        onClick={() => setOpen(true)}
        // 48 px to touch (DESIGN.md), but no border: the card stays calm.
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <EllipsisVertical aria-hidden className="size-5" />
      </button>
      <BottomSheet
        id={sheetId}
        open={open}
        title={customer.name}
        onClose={close}
      >
        {confirming ? (
          <ArchiveForm
            organizationId={organizationId}
            customer={customer}
            onCancel={() => setConfirming(false)}
          />
        ) : (
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
                  Pour supprimer ce client, enregistrez d’abord son
                  remboursement : il vous doit encore {owed}.
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
        )}
      </BottomSheet>
    </li>
  );
}
