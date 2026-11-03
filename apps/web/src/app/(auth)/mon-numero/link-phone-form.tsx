'use client';

import { Suspense, useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { NextField } from '@/components/next-field';
import { PhoneField, PinField } from '@/components/phone-field';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { linkPhone } from '../actions';

export function LinkPhoneForm() {
  const [state, action, pending] = useActionState(linkPhone, initialFormState);
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
        hint="Il remplace votre mot de passe."
        error={state.fieldErrors?.pin}
      />
      <PinField
        label="Retapez le code secret"
        name="confirmation"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmation}
      />
      <SubmitButton pendingLabel="Enregistrement…">
        Passer au numéro de téléphone
      </SubmitButton>
    </ActionForm>
  );
}
