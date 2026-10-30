'use client';

import type { ShopMarkKind } from '@nagaw/shared';
import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { PhotoField } from '@/components/catalog/photo-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updateMark } from '../actions';

const WORDS = {
  signature: {
    legend: 'Signature (facultatif)',
    the: 'la signature',
    preview: 'Aperçu de la signature',
    choose: 'Choisir une signature',
    save: 'Valider la signature',
  },
  stamp: {
    legend: 'Cachet (facultatif)',
    the: 'le cachet',
    preview: 'Aperçu du cachet',
    choose: 'Choisir un cachet',
    save: 'Valider le cachet',
  },
} as const;

/** The signature or the stamp printed on issued invoices (ADR-052). */
export function MarkForm({
  organizationId,
  kind,
  currentUrl,
}: {
  organizationId: string;
  kind: ShopMarkKind;
  currentUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateMark, initialFormState);
  const words = WORDS[kind];
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value={kind} />
      <FormMessage state={state} />
      <PhotoField
        logo
        words={words}
        legend={words.legend}
        currentUrl={currentUrl}
        error={state.fieldErrors?.photo}
      />
      <div>
        <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
          {words.save}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
