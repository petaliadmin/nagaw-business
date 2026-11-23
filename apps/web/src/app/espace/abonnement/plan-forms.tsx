'use client';

import {
  formatAmount,
  SUBSCRIPTION_PERIOD_LABELS,
  SUBSCRIPTION_PERIODS,
  type PlanDto,
} from '@nagaw/shared';
import { useActionState, useId } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/form-state';
import { cancelPlanRequest, requestPlan, setAutoRenew } from './actions';

export function RequestPlanForm({
  organizationId,
  plan,
}: {
  organizationId: string;
  plan: PlanDto;
}) {
  const ids = useId();
  const planKey = plan.key;
  const planName = plan.name;
  const paid = plan.monthlyPrice > 0;
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
      {paid && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">
            Pour combien de temps ?
          </legend>
          {SUBSCRIPTION_PERIODS.map((period, index) => (
            <label
              key={period}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong px-3 has-checked:border-ink"
            >
              <input
                type="radio"
                name="period"
                value={period}
                defaultChecked={index === 0}
                id={`${ids}-${period}`}
                className="size-5"
              />
              <span className="font-bold">
                {SUBSCRIPTION_PERIOD_LABELS[period]}
              </span>
              <span className="ml-auto tabular-nums">
                {formatAmount(
                  period === 'year' ? plan.yearlyPrice : plan.monthlyPrice,
                  plan.currency,
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}
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

/** « Renouveler automatiquement » (ADR-073), for the owner. */
export function AutoRenewForm({
  organizationId,
  autoRenew,
}: {
  organizationId: string;
  autoRenew: boolean;
}) {
  const [state, action, pending] = useActionState(
    setAutoRenew,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="autoRenew" value={String(!autoRenew)} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
          {autoRenew
            ? 'Arrêter le renouvellement automatique'
            : 'Renouveler automatiquement'}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
