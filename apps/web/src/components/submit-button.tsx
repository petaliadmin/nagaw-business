'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
