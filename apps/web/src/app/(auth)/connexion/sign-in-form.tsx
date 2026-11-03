'use client';

import { Suspense, useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { NextField } from '@/components/next-field';
import { PhoneField, PinField } from '@/components/phone-field';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { signIn } from '../actions';

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialFormState);
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
      <PhoneField errors={state.fieldErrors} />
      <PinField
        autoComplete="current-password"
        error={state.fieldErrors?.pin}
      />
      <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
    </ActionForm>
  );
}
