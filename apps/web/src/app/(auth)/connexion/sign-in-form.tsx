'use client';

import { DEFAULT_ACCOUNT_COUNTRY, formatAccountPhone } from '@nagaw/shared';
import { Suspense, useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { NextField } from '@/components/next-field';
import { PhoneField, PinField } from '@/components/phone-field';
import { PinPad } from '@/components/pin-pad';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import { changePhone, signIn } from '../actions';

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

/**
 * The number already signed in on this device (ADR-059): only the secret
 * code is asked, on the digit keys.
 */
export function KnownPhoneSignInForm({ phone }: { phone: string }) {
  const [state, action, pending] = useActionState(signIn, initialFormState);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-lg">
        Numéro{' '}
        <strong className="whitespace-nowrap tabular-nums">
          {formatAccountPhone(phone)}
        </strong>
      </p>
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
        {/* With `+`, the number keeps its own code whatever the country. */}
        <input type="hidden" name="country" value={DEFAULT_ACCOUNT_COUNTRY} />
        <input type="hidden" name="number" value={`+${phone}`} />
        <PinPad error={state.fieldErrors?.pin} />
      </ActionForm>
      <form action={changePhone} className="flex justify-center">
        <Suspense fallback={null}>
          <NextField />
        </Suspense>
        <button type="submit" className={buttonClasses('secondary', 'w-full')}>
          Ce n’est pas mon numéro
        </button>
      </form>
    </div>
  );
}
