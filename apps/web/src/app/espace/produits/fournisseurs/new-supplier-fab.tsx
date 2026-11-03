'use client';

import { NewContactFab } from '@/components/contacts/new-contact-fab';
import { SupplierForm } from './supplier-forms';

/** « + » of the suppliers list: create a supplier, or import a contact. */
export function NewSupplierFab({ organizationId }: { organizationId: string }) {
  return (
    <NewContactFab
      label="Ajouter un fournisseur"
      title="Nouveau fournisseur"
      submitLabel="Ajouter le fournisseur"
    >
      {(initial, close) => (
        <SupplierForm
          organizationId={organizationId}
          initial={initial}
          onDone={close}
        />
      )}
    </NewContactFab>
  );
}
