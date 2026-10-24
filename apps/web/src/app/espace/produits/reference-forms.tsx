'use client';

import { CATEGORY_COLORS, type CategoryColor } from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { CATEGORY_COLOR_LABELS } from '@/lib/catalog/labels';
import { createReference, updateReference } from './actions';

export type ReferenceKind = 'category' | 'supplier' | 'taxRate';

const COLOR_OPTIONS = CATEGORY_COLORS.map((color) => ({
  value: color,
  label: CATEGORY_COLOR_LABELS[color],
}));

/** Fields specific to each list, shared by the add and edit forms. */
function Fields({
  kind,
  errors,
  values,
  idPrefix,
}: {
  kind: ReferenceKind;
  errors: Record<string, string>;
  values?: ReferenceItem;
  idPrefix: string;
}) {
  // Field ids must be unique on a page listing several rows.
  const id = (name: string) => `${idPrefix}${name}`;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        label={kind === 'taxRate' ? 'Nom de la taxe' : 'Nom'}
        name="name"
        id={id('name')}
        defaultValue={values?.name}
        required
        maxLength={kind === 'supplier' ? 120 : 60}
        autoComplete="off"
        error={errors.name}
      />
      {kind === 'category' && (
        <SelectField
          label="Couleur"
          name="color"
          id={id('color')}
          defaultValue={values?.color ?? 'brand'}
          options={COLOR_OPTIONS}
          error={errors.color}
        />
      )}
      {kind === 'supplier' && (
        <FormField
          label="Téléphone (facultatif)"
          name="phone"
          id={id('phone')}
          type="tel"
          inputMode="tel"
          defaultValue={values?.phone}
          maxLength={30}
          error={errors.phone}
        />
      )}
      {kind === 'taxRate' && (
        <FormField
          label="Taux en %"
          name="rate"
          id={id('rate')}
          inputMode="decimal"
          defaultValue={
            values?.rateBasisPoints !== undefined
              ? String(values.rateBasisPoints / 100).replace('.', ',')
              : undefined
          }
          required
          error={errors.rate}
        />
      )}
    </div>
  );
}

export interface ReferenceItem {
  id: string;
  name: string;
  status: 'active' | 'archived';
  color?: CategoryColor;
  phone?: string;
  rateBasisPoints?: number;
}

export function CreateReferenceForm({
  kind,
  organizationId,
  submitLabel,
}: {
  kind: ReferenceKind;
  organizationId: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(
    createReference,
    initialFormState,
  );
  // A new key after each success clears the form for the next entry.
  const [added, setAdded] = useState(0);
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') setAdded((n) => n + 1);
  }
  return (
    <ActionForm
      key={added}
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value={kind} />
      <FormMessage state={state} />
      <Fields kind={kind} errors={state.fieldErrors ?? {}} idPrefix="new-" />
      <div>
        <SubmitButton pendingLabel="Ajout…">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Rename (and recolor) a row, or archive / restore it. */
export function ReferenceRowActions({
  kind,
  organizationId,
  item,
}: {
  kind: ReferenceKind;
  organizationId: string;
  item: ReferenceItem;
}) {
  const [editState, editAction, editPending] = useActionState(
    updateReference,
    initialFormState,
  );
  const [statusState, statusAction] = useActionState(
    updateReference,
    initialFormState,
  );
  const [open, setOpen] = useState(false);
  const [handled, setHandled] = useState<FormState>(editState);
  if (editState !== handled) {
    setHandled(editState);
    if (editState.status === 'success') setOpen(false);
  }
  const archived = item.status === 'archived';
  return (
    <div className="flex flex-col gap-3">
      <FormMessage
        state={editState.status === 'success' ? editState : statusState}
      />
      <div className="flex flex-wrap gap-2">
        {!archived && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-12 items-center rounded-xl border-2 border-line-strong bg-surface px-4 text-base font-bold"
            aria-label={`Modifier ${item.name}`}
          >
            Modifier
          </button>
        )}
        <form action={statusAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />
          <input
            type="hidden"
            name="status"
            value={archived ? 'active' : 'archived'}
          />
          <SubmitButton
            variant="secondary"
            pendingLabel="…"
            aria-label={`${archived ? 'Réactiver' : 'Archiver'} ${item.name}`}
          >
            {archived ? 'Réactiver' : 'Archiver'}
          </SubmitButton>
        </form>
      </div>
      {open && (
        <ActionForm
          action={editAction}
          pending={editPending}
          className="flex flex-col gap-4 rounded-2xl bg-surface-muted p-4"
          noValidate
        >
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />
          {editState.status === 'error' && <FormMessage state={editState} />}
          <Fields
            kind={kind}
            errors={editState.fieldErrors ?? {}}
            values={item}
            idPrefix={`${item.id}-`}
          />
          <div>
            <SubmitButton pendingLabel="Enregistrement…">
              Enregistrer
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
