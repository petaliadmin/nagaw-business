'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { PhotoField } from '@/components/catalog/photo-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updateLogo } from '../actions';

/** The shop's logo, printed on its quotes and invoices (ADR-044). */
export function LogoForm({
  organizationId,
  currentUrl,
}: {
  organizationId: string;
  currentUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateLogo, initialFormState);
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormMessage state={state} />
      <PhotoField
        logo
        legend="Logo (facultatif)"
        currentUrl={currentUrl}
        error={state.fieldErrors?.photo}
      />
      <div>
        <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
          Valider le logo
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
