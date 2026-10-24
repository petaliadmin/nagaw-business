'use client';

import { Suspense, useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { NextField } from '@/components/next-field';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { signUp } from '../actions';

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialFormState);
  if (state.status === 'success') return <FormMessage state={state} />;
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormMessage state={state} />
      <Suspense fallback={null}>
        <NextField />
      </Suspense>
      <FormField
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <FormField
        label="Mot de passe (8 caractères minimum)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        error={state.fieldErrors?.password}
      />
      <FormField
        label="Confirmation du mot de passe"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmation}
      />
      <SubmitButton pendingLabel="Création…">Créer mon compte</SubmitButton>
    </ActionForm>
  );
}
