'use client';

import { useFormStatus } from 'react-dom';
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
  const { pending } = useFormStatus();
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
