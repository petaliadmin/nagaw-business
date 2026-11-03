'use client';

import Link from 'next/link';
import { Suspense, useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { NextField } from '@/components/next-field';
import { PhoneField, PinField } from '@/components/phone-field';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { signUp } from '../actions';

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialFormState);
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
        label="Choisissez un code secret (4 chiffres)"
        autoComplete="new-password"
        hint="Gardez-le pour vous. Il vous servira à chaque connexion."
        error={state.fieldErrors?.pin}
      />
      <PinField
        label="Retapez le code secret"
        name="confirmation"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmation}
      />
      <p className="text-ink-muted">
        En créant un compte, vous acceptez les{' '}
        <Link
          href="/conditions"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          conditions d’utilisation
        </Link>{' '}
        et la{' '}
        <Link
          href="/confidentialite"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          politique de confidentialité
        </Link>
        .
      </p>
      <SubmitButton pendingLabel="Création…">Créer mon compte</SubmitButton>
    </ActionForm>
  );
}
