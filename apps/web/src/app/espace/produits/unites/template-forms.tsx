'use client';

import { UNIT_KEYS, UNITS, type UnitTemplateDto } from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { archiveUnitTemplate, createUnitTemplate } from '../actions';

export function TemplateForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(
    createUnitTemplate,
    initialFormState,
  );
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
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
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField
          label="Nom de l’unité"
          name="label"
          maxLength={60}
          placeholder="Sac de 50 kg"
          error={errors.label}
        />
        <SelectField
          label="Pour les produits comptés en"
          name="stockUnit"
          defaultValue="kg"
          options={UNIT_KEYS.map((key) => ({
            value: key,
            label: UNITS[key].label,
          }))}
          error={errors.stockUnit}
        />
        <FormField
          label="Combien dans une unité ?"
          name="factor"
          inputMode="decimal"
          hint="50 pour un sac de 50 kg, 0,5 pour un demi."
          error={errors.factor}
        />
      </div>
      <label className="flex min-h-12 items-center gap-3 font-semibold">
        <input type="checkbox" name="allowsDecimals" className="size-6" />
        Se vend aussi en partie (1,5 par exemple)
      </label>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Ajouter le modèle
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** A template is a copy source: retiring it changes no product. */
export function ArchiveTemplateForm({
  organizationId,
  template,
}: {
  organizationId: string;
  template: UnitTemplateDto;
}) {
  const [state, action, pending] = useActionState(
    archiveUnitTemplate,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="templateId" value={template.id} />
      <FormMessage state={state} />
      <SubmitButton
        variant="secondary"
        pendingLabel="Enregistrement…"
        aria-label={`Retirer le modèle ${template.label}`}
      >
        Retirer
      </SubmitButton>
    </ActionForm>
  );
}
