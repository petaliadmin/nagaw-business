import type { FormState } from '@/lib/auth/schemas';

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === 'idle' || !state.message) return null;
  const tone =
    state.status === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-3 py-2 text-sm ${tone}`}
    >
      {state.message}
    </p>
  );
}
