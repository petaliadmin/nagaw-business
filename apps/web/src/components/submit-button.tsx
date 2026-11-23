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
  className = '',
  'aria-label': ariaLabel,
  name,
  value,
}: {
  children: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  className?: string;
  'aria-label'?: string;
  /** Sent with the form when this button submits it. */
  name?: string;
  value?: string;
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
      name={name}
      value={value}
      className={buttonClasses(variant, className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
