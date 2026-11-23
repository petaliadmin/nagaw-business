'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { PinField } from '@/components/phone-field';
import { initialFormState } from '@/lib/auth/form-state';
import {
  formatAmount,
  SUBSCRIPTION_PERIOD_LABELS,
  type SubscriptionInvoiceDto,
} from '@nagaw/shared';
import { useConfirmedSubmit } from '@/components/ui/confirm-dialog';
import {
  decideInvoice,
  renewShop,
  setShopSubscription,
  answerFeedback,
  openShopAccess,
  reactivateShop,
  resolvePlanRequest,
  setMemberPin,
  setShopPlan,
  suspendShop,
} from './actions';

export function SetPinForm({
  shopId,
  userId,
  who,
}: {
  shopId: string;
  userId: string;
  who: string;
}) {
  const [state, action, pending] = useActionState(
    setMemberPin,
    initialFormState,
  );
  return (
    <ActionForm
      key={state.status === 'success' ? state.message : 'form'}
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="userId" value={userId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PinField
          label={`Nouveau code de ${who}`}
          id={`pin-${userId}`}
          autoComplete="new-password"
          error={state.fieldErrors?.pin}
        />
        <PinField
          label="Retapez le code"
          name="confirmation"
          id={`pin-confirmation-${userId}`}
          autoComplete="new-password"
          error={state.fieldErrors?.confirmation}
        />
      </div>
      <div>
        <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
          Donner ce code
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SelectField
          label="Durée"
          name="period"
          id="admin-plan-period"
          defaultValue="month"
          options={[
            { value: 'month', label: SUBSCRIPTION_PERIOD_LABELS.month },
            { value: 'year', label: SUBSCRIPTION_PERIOD_LABELS.year },
          ]}
        />
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

/** « Prolonger » by hand: one month or one year, payment received. */
export function RenewForm({ shopId }: { shopId: string }) {
  const [state, action, pending] = useActionState(renewShop, initialFormState);
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="shopId" value={shopId} />
      <FormMessage state={state} />
      <FormField
        label="Remarque (facultatif)"
        name="note"
        id="admin-renew-note"
        maxLength={500}
        placeholder="Wave reçu le…"
      />
      <div className="flex flex-wrap gap-2">
        {(['month', 'year'] as const).map((period) => (
          <SubmitButton
            key={period}
            name="period"
            value={period}
            variant={period === 'month' ? 'primary' : 'secondary'}
            pendingLabel="Prolongation…"
          >
            {`Prolonger de ${SUBSCRIPTION_PERIOD_LABELS[period]}`}
          </SubmitButton>
        ))}
      </div>
    </ActionForm>
  );
}

/** One switch of the subscription: automatic renewal or lifetime. */
export function SubscriptionSwitch({
  shopId,
  field,
  value,
  label,
  confirmation,
}: {
  shopId: string;
  field: 'autoRenew' | 'lifetime';
  /** The value it sets. */
  value: boolean;
  label: string;
  confirmation?: { title: string; message: string };
}) {
  const [state, action, pending] = useActionState(
    setShopSubscription,
    initialFormState,
  );
  const [guard, confirmDialog] = useConfirmedSubmit();
  return (
    <form
      action={action}
      onSubmit={(event) =>
        guard(
          event,
          confirmation ? { ...confirmation, confirmLabel: label } : null,
        )
      }
      className="flex flex-col gap-2"
    >
      {confirmDialog}
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(value)} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
          {label}
        </SubmitButton>
      </div>
      {pending && <span className="sr-only">Enregistrement…</span>}
    </form>
  );
}

/** « Marquer payée » or « Annuler » on an invoice to collect. */
export function InvoiceDecision({
  invoice,
  shopName,
}: {
  invoice: SubscriptionInvoiceDto;
  shopName?: string;
}) {
  const [state, action, pending] = useActionState(
    decideInvoice,
    initialFormState,
  );
  const amount = formatAmount(invoice.amount, invoice.currency);
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          name="decision"
          value="paid"
          pendingLabel="Enregistrement…"
          aria-label={`Marquer payée : ${invoice.reference}${shopName ? `, ${shopName}` : ''}, ${amount}`}
        >
          Marquer payée
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="cancel"
          variant="secondary"
          pendingLabel="Annulation…"
          aria-label={`Annuler la facture ${invoice.reference}${shopName ? `, ${shopName}` : ''}`}
        >
          Annuler
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
