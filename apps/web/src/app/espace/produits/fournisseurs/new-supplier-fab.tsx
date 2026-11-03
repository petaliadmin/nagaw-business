'use client';

import dynamic from 'next/dynamic';
import { SheetLoading } from '@/components/contacts/contact-actions';
import { NewContactFab } from '@/components/contacts/new-contact-fab';

// Loaded when the sheet opens: the list stays light (performance budget).
const SupplierForm = dynamic(
  () => import('./supplier-forms').then((mod) => mod.SupplierForm),
  { ssr: false, loading: SheetLoading },
);

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
