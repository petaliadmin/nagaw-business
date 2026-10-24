'use client';

import { useFormStatus } from 'react-dom';
import { useActionFormPending } from '@/components/action-form';
import {
  buttonClasses,
  type ButtonVariant,
} from '@/components/ui/button-styles';

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  'aria-label': ariaLabel,
}: {
  children: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  'aria-label'?: string;
}) {
  // Native form actions report through useFormStatus, ActionForm through
  // its context.
  const { pending: submitting } = useFormStatus();
  const dispatching = useActionFormPending();
  const pending = submitting || dispatching;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-label={ariaLabel}
      className={buttonClasses(variant)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
