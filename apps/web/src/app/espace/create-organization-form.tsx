'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { createOrganization } from './actions';

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(
    createOrganization,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormMessage state={state} />
      <FormField
        label="Nom de la boutique"
        name="name"
        autoComplete="organization"
        required
        minLength={2}
        maxLength={120}
        error={state.fieldErrors?.name}
      />
      <SubmitButton pendingLabel="Création…">Créer la boutique</SubmitButton>
    </ActionForm>
  );
}
