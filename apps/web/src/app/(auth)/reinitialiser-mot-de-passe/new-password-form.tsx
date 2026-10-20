'use client';

import { useActionState } from 'react';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { updatePassword } from '../actions';

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        label="Nouveau mot de passe (8 caractères minimum)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        error={state.fieldErrors?.password}
      />
      <FormField
        label="Confirmation"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmation}
      />
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </form>
  );
}
