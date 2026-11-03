'use client';

import dynamic from 'next/dynamic';
import { SheetLoading } from '@/components/contacts/contact-actions';
import { NewContactFab } from '@/components/contacts/new-contact-fab';

// Loaded when the sheet opens: the list stays light (performance budget).
const CustomerForm = dynamic(
  () => import('./customer-forms').then((mod) => mod.CustomerForm),
  { ssr: false, loading: SheetLoading },
);

/** « + » of the customers list: create a customer, or import a contact. */
export function NewCustomerFab({
  organizationId,
  currency,
}: {
  organizationId: string;
  currency: string;
}) {
  return (
    <NewContactFab
      label="Ajouter un client"
      title="Nouveau client"
      submitLabel="Ajouter le client"
    >
      {(initial) => (
        <CustomerForm
          organizationId={organizationId}
          currency={currency}
          initial={initial}
          stacked
        />
      )}
    </NewContactFab>
  );
}
