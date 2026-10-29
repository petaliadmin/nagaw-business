'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import {
  answerFeedback,
  openShopAccess,
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

export function OpenAccessForm({ shopId }: { shopId: string }) {
  const [state, action, pending] = useActionState(
    openShopAccess,
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
      <FormField
        label="Pourquoi entrez-vous dans cette boutique ?"
        name="reason"
        id="admin-access-reason"
        maxLength={500}
        required
        placeholder="Aide demandée par le propriétaire…"
        error={state.fieldErrors?.reason}
      />
      <div>
        <SubmitButton pendingLabel="Ouverture…">
          Entrer dans la boutique
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

export function AnswerFeedbackForm({
  feedbackId,
  answered,
}: {
  feedbackId: string;
  answered: boolean;
}) {
  const [state, action, pending] = useActionState(
    answerFeedback,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <FormMessage state={state} />
      {!answered && (
        <FormField
          label="Réponse à la boutique (facultatif)"
          name="answer"
          id={`answer-${feedbackId}`}
          maxLength={2000}
          error={state.fieldErrors?.answer}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="status"
          value="read"
          disabled={pending}
          className={buttonClasses('secondary')}
        >
          Marquer comme lu
        </button>
        <button
          type="submit"
          name="status"
          value="done"
          disabled={pending}
          className={buttonClasses('primary')}
        >
          {answered ? 'Marquer comme traité' : 'Répondre et clore'}
        </button>
      </div>
    </ActionForm>
  );
}
