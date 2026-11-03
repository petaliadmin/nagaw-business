'use client';

import { NewContactFab } from '@/components/contacts/new-contact-fab';
import { CustomerForm } from './customer-forms';

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
