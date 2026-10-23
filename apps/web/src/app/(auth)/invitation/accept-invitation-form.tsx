'use client';

import { useActionState } from 'react';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { acceptInvitation } from '@/app/espace/actions';
import { initialFormState } from '@/lib/auth/schemas';

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Validation…">
          Accepter l’invitation
        </SubmitButton>
      </div>
    </form>
  );
}
