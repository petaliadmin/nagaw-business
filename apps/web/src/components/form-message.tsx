import { Alert } from '@/components/ui/alert';
import type { FormState } from '@/lib/auth/schemas';

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === 'idle' || !state.message) return null;
  return (
    <Alert tone={state.status === 'error' ? 'error' : 'success'}>
      {state.message}
    </Alert>
  );
}
