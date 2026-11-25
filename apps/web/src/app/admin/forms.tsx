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
  PLAN_MODULE_DESCRIPTIONS,
  PLAN_MODULE_LABELS,
  PLAN_MODULES,
  SUBSCRIPTION_PERIOD_LABELS,
  type AdminPlanDto,
  type SubscriptionInvoiceDto,
} from '@nagaw/shared';
import { useConfirmedSubmit } from '@/components/ui/confirm-dialog';
import {
  actOnShopData,
  setArchived,
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
  updatePlan,
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

/**
 * Archive a shop or an account, with a reason and a confirmation; or
 * restore it (ADR-074).
 */
export function ArchiveForm({
  target,
  targetId,
  name,
  archived,
}: {
  target: 'shop' | 'user';
  targetId: string;
  /** What is archived, in the confirmation and the button's name. */
  name: string;
  archived: boolean;
}) {
  const [state, action, pending] = useActionState(
    setArchived,
    initialFormState,
  );
  const [guard, confirmDialog] = useConfirmedSubmit();
  const label = archived
    ? target === 'shop'
      ? 'Restaurer la boutique'
      : 'Rouvrir le compte'
    : target === 'shop'
      ? 'Archiver la boutique'
      : 'Archiver le compte';
  return (
    <form
      action={action}
      noValidate
      onSubmit={(event) =>
        guard(
          event,
          archived
            ? null
            : {
                title: `Archiver ${name} ?`,
                message:
                  target === 'shop'
                    ? 'Ses membres n’y ont plus accès et elle sort des listes. Ventes, factures et historique restent ; vous pourrez la restaurer.'
                    : 'La personne ne peut plus se connecter, dans aucune boutique. Ses ventes et l’historique restent ; vous pourrez rouvrir le compte.',
                confirmLabel: 'Archiver',
                tone: 'danger',
              },
        )
      }
      className="flex flex-col gap-3"
    >
      {confirmDialog}
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="restore" value={String(archived)} />
      <FormMessage state={state} />
      {!archived && (
        <FormField
          label="Pourquoi archiver ?"
          name="reason"
          id={`archive-reason-${targetId}`}
          maxLength={300}
          required
          error={state.fieldErrors?.reason}
        />
      )}
      <div>
        <SubmitButton
          variant={archived ? 'primary' : 'danger'}
          pendingLabel="Enregistrement…"
          aria-label={`${label} : ${name}`}
        >
          {label}
        </SubmitButton>
      </div>
      {pending && <span className="sr-only">Enregistrement…</span>}
    </form>
  );
}

const DATA_ACTION_LABELS = {
  archive: 'Archiver',
  restore: 'Restaurer',
  cancel: 'Annuler',
} as const;

/** One action on an item of a shop: a reason, then the button (ADR-074). */
export function ShopDataAction({
  shopId,
  kind,
  itemId,
  action,
  label,
}: {
  shopId: string;
  kind: string;
  itemId: string;
  action: 'archive' | 'restore' | 'cancel';
  /** What the item is, for the button's name. */
  label: string;
}) {
  const [state, action_, pending] = useActionState(
    actOnShopData,
    initialFormState,
  );
  return (
    <ActionForm
      action={action_}
      pending={pending}
      noValidate
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="action" value={action} />
      <FormMessage state={state} />
      {action !== 'restore' && (
        <div className="flex-1">
          <FormField
            label="Pourquoi ?"
            name="reason"
            id={`data-reason-${itemId}`}
            maxLength={300}
            error={state.fieldErrors?.reason}
          />
        </div>
      )}
      <SubmitButton
        variant={action === 'restore' ? 'secondary' : 'danger'}
        pendingLabel="Enregistrement…"
        aria-label={`${DATA_ACTION_LABELS[action]} : ${label}`}
      >
        {DATA_ACTION_LABELS[action]}
      </SubmitButton>
    </ActionForm>
  );
}

/** « à la boutique de l’offre », « aux 3 boutiques de l’offre ». */
export function shopsOf(n: number): string {
  if (n === 0) return 'aux boutiques qui la prendront';
  return n === 1 ? 'à la boutique de l’offre' : `aux ${n} boutiques de l’offre`;
}

/** A number of the offer: empty means « sans limite » where it may be. */
function LimitField({
  plan,
  name,
  label,
  value,
  error,
  optional = true,
  hint,
  placeholder = 'Sans limite',
}: {
  plan: string;
  name: string;
  label: string;
  value: number | null;
  error: string | undefined;
  optional?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <FormField
      label={label}
      name={name}
      id={`${plan}-${name}`}
      inputMode="numeric"
      autoComplete="off"
      defaultValue={value === null ? '' : String(value)}
      placeholder={optional ? placeholder : undefined}
      hint={hint ?? (optional ? 'Vide : sans limite.' : undefined)}
      error={error}
    />
  );
}

/**
 * Prices, limits and modules of an offer (ADR-075). Saved, it applies at
 * once to every shop of the offer: what they have stays, only what they
 * add beyond is refused.
 */
export function PlanForm({ plan }: { plan: AdminPlanDto }) {
  const [state, action, pending] = useActionState(updatePlan, initialFormState);
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};
  const { limits } = plan;
  const label = `Enregistrer l’offre ${plan.name}`;
  return (
    // Keeps what was typed when a number is refused.
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="planKey" value={plan.key} />
      <FormMessage state={state} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-bold">Prix (F CFA)</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LimitField
            plan={plan.key}
            name="monthlyPrice"
            label="Par mois"
            value={plan.monthlyPrice}
            optional={false}
            hint="0 : offre gratuite."
            error={errors.monthlyPrice}
          />
          <LimitField
            plan={plan.key}
            name="yearlyPrice"
            label="Pour un an"
            value={plan.yearlyPriceSet}
            placeholder="Douze mois"
            hint={`Vide : douze mois, ${formatAmount(plan.monthlyPrice * 12, plan.currency)}.`}
            error={errors.yearlyPrice}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-bold">
          Ce que l’offre permet
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LimitField
            plan={plan.key}
            name="limits.products"
            label="Produits"
            value={limits.products}
            error={errors['limits.products']}
          />
          <LimitField
            plan={plan.key}
            name="limits.members"
            label="Personnes dans l’équipe"
            value={limits.members}
            optional={false}
            error={errors['limits.members']}
          />
          <LimitField
            plan={plan.key}
            name="limits.devices"
            label="Téléphones de caisse"
            value={limits.devices}
            optional={false}
            error={errors['limits.devices']}
          />
          <LimitField
            plan={plan.key}
            name="limits.customers"
            label="Clients"
            value={limits.customers}
            hint="Vide : sans limite. Un client créé à la caisse hors ligne est toujours accepté."
            error={errors['limits.customers']}
          />
          <LimitField
            plan={plan.key}
            name="limits.suppliers"
            label="Fournisseurs"
            value={limits.suppliers}
            error={errors['limits.suppliers']}
          />
          <LimitField
            plan={plan.key}
            name="limits.salesPerMonth"
            label="Ventes par mois"
            value={limits.salesPerMonth}
            hint="Vide : sans limite. Une vente n’est jamais refusée : au-delà, la boutique est prévenue."
            error={errors['limits.salesPerMonth']}
          />
          <LimitField
            plan={plan.key}
            name="limits.invoicesPerMonth"
            label="Factures par mois"
            value={limits.invoicesPerMonth}
            error={errors['limits.invoicesPerMonth']}
          />
          <LimitField
            plan={plan.key}
            name="limits.quotesPerMonth"
            label="Devis par mois"
            value={limits.quotesPerMonth}
            error={errors['limits.quotesPerMonth']}
          />
          <LimitField
            plan={plan.key}
            name="limits.historyMonths"
            label="Historique affiché (mois)"
            value={limits.historyMonths}
            hint="Vide : tout l’historique. Au moins 3 mois. Rien n’est effacé, et la comptabilité reste entière."
            error={errors['limits.historyMonths']}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-bold">Modules compris</legend>
        {PLAN_MODULES.map((module) => (
          <label
            key={module}
            className="flex min-h-12 items-start gap-3 rounded-2xl bg-surface-muted px-4 py-3"
          >
            <input
              type="checkbox"
              name="modules"
              value={module}
              defaultChecked={limits.modules.includes(module)}
              aria-label={PLAN_MODULE_LABELS[module]}
              aria-describedby={`${plan.key}-module-${module}`}
              className="mt-1 size-6 shrink-0 accent-brand-strong"
            />
            <span className="flex flex-col">
              <span className="font-bold">{PLAN_MODULE_LABELS[module]}</span>
              <span
                id={`${plan.key}-module-${module}`}
                className="text-ink-muted"
              >
                {PLAN_MODULE_DESCRIPTIONS[module]}
              </span>
            </span>
          </label>
        ))}
        {errors['limits.modules'] && (
          <p className="font-semibold text-danger-ink">
            {errors['limits.modules']}
          </p>
        )}
      </fieldset>

      <p className="text-ink-muted">
        Enregistrée, l’offre s’applique tout de suite {shopsOf(plan.shops)}.
        Rien de ce qu’elles ont déjà n’est supprimé : seuls les ajouts au-delà
        sont refusés.
      </p>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">{label}</SubmitButton>
      </div>
      {pending && <span className="sr-only">Enregistrement…</span>}
    </ActionForm>
  );
}
