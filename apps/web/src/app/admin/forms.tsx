'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import {
  reactivateShop,
  resolvePlanRequest,
  setShopPlan,
  suspendShop,
} from './actions';

export function SetPlanForm({
  shopId,
  currentPlan,
  plans,
}: {
  shopId: string;
  currentPlan: string;
  plans: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    setShopPlan,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="shopId" value={shopId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Nouvelle offre"
          name="planKey"
          id="admin-plan"
          defaultValue={currentPlan}
          options={plans}
          error={state.fieldErrors?.planKey}
        />
        <FormField
          label="Remarque (facultatif)"
          name="note"
          id="admin-plan-note"
          maxLength={500}
          placeholder="Paiement reçu par Wave le…"
          error={state.fieldErrors?.note}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Changement…">Changer l’offre</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SuspendForm({
  shopId,
  suspended,
}: {
  shopId: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState(
    suspended ? reactivateShop : suspendShop,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="shopId" value={shopId} />
      <FormMessage state={state} />
      {!suspended && (
        <FormField
          label="Pourquoi suspendre cette boutique ?"
          name="reason"
          id="admin-suspend-reason"
          maxLength={500}
          required
          error={state.fieldErrors?.reason}
        />
      )}
      <div>
        <SubmitButton
          variant={suspended ? 'primary' : 'danger'}
          pendingLabel="Enregistrement…"
        >
          {suspended ? 'Réactiver la boutique' : 'Suspendre la boutique'}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ResolveRequestForm({
  requestId,
  shopName,
}: {
  requestId: string;
  shopName: string;
}) {
  const [state, action, pending] = useActionState(
    resolvePlanRequest,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <FormMessage state={state} />
      <FormField
        label="Remarque (facultatif)"
        name="note"
        id={`note-${requestId}`}
        maxLength={500}
        placeholder="Paiement reçu, motif du refus…"
        error={state.fieldErrors?.note}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          aria-label={`Accepter la demande de ${shopName}`}
          className={buttonClasses('primary')}
        >
          Accepter
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          aria-label={`Refuser la demande de ${shopName}`}
          className={buttonClasses('danger')}
        >
          Refuser
        </button>
      </div>
    </ActionForm>
  );
}
