'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { cancelPlanRequest, requestPlan } from './actions';

export function RequestPlanForm({
  organizationId,
  planKey,
  planName,
}: {
  organizationId: string;
  planKey: string;
  planName: string;
}) {
  const [state, action, pending] = useActionState(
    requestPlan,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="planKey" value={planKey} />
      <FormMessage state={state} />
      <SubmitButton
        pendingLabel="Envoi…"
        aria-label={`Demander l’offre ${planName}`}
      >
        Demander cette offre
      </SubmitButton>
    </ActionForm>
  );
}

export function CancelPlanRequestForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, action, pending] = useActionState(
    cancelPlanRequest,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" pendingLabel="Annulation…">
          Annuler la demande
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
