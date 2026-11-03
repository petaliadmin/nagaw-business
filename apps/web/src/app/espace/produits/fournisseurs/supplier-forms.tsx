'use client';

import type { SupplierDto } from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import type { CustomerContact } from '@/lib/customers/contact';
import { createReference, updateReference } from '../actions';

/** Calls `onDone` once, when the server answers with a success. */
function useOnSuccess(state: FormState, onDone?: () => void) {
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') onDone?.();
  }
}

/** Adds a supplier, or changes its name and number. */
export function SupplierForm({
  organizationId,
  supplier,
  initial,
  onDone,
}: {
  organizationId: string;
  /** Absent on creation. */
  supplier?: SupplierDto;
  /** On creation, what a contact of the phone already gives. */
  initial?: CustomerContact;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    supplier ? updateReference : createReference,
    initialFormState,
  );
  useOnSuccess(state, onDone);
  const errors = state.fieldErrors ?? {};
  const prefix = supplier ? `${supplier.id}-` : 'new-supplier-';
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value="supplier" />
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <FormMessage state={state} />
      <FormField
        label="Nom"
        name="name"
        id={`${prefix}name`}
        defaultValue={supplier?.name ?? initial?.name}
        required
        maxLength={120}
        autoComplete="off"
        error={errors.name}
      />
      <FormField
        label="Téléphone (facultatif)"
        name="phone"
        id={`${prefix}phone`}
        type="tel"
        inputMode="tel"
        defaultValue={supplier?.phone ?? initial?.phone}
        maxLength={30}
        error={errors.phone}
      />
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {supplier ? 'Enregistrer' : 'Ajouter le fournisseur'}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Takes a supplier off the list, or puts it back. Archived, not erased: the
 * stock already received keeps its name. Removing asks first.
 */
export function SupplierStatusForm({
  organizationId,
  supplier,
  onCancel,
  onDone,
}: {
  organizationId: string;
  supplier: SupplierDto;
  onCancel?: () => void;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateReference,
    initialFormState,
  );
  useOnSuccess(state, onDone);
  const archived = supplier.status === 'archived';
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value="supplier" />
      <input type="hidden" name="id" value={supplier.id} />
      <input
        type="hidden"
        name="status"
        value={archived ? 'active' : 'archived'}
      />
      <FormMessage state={state} />
      {archived ? (
        <p className="text-lg font-bold">
          Remettre {supplier.name} dans vos fournisseurs ?
        </p>
      ) : (
        <>
          <p className="text-lg font-bold">
            Supprimer {supplier.name} de vos fournisseurs ?
          </p>
          <p className="text-ink-muted">
            Le stock déjà reçu de chez lui garde son nom.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <SubmitButton
          variant={archived ? 'primary' : 'danger'}
          pendingLabel="Enregistrement…"
        >
          {archived ? 'Oui, remettre' : 'Oui, supprimer'}
        </SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses('secondary')}
        >
          Non
        </button>
      </div>
    </ActionForm>
  );
}
