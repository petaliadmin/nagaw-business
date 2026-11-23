'use client';

import {
  formatAmount,
  ORDER_STATUS_LABELS,
  statusesFor,
  type OrderDto,
  type PaymentMethod,
} from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/form-state';
import { PAYMENT_LABELS } from '@/lib/sales/labels';
import {
  cancelOrder,
  deliverOrder,
  receiveDeposit,
  setOrderStatus,
} from '../actions';
import { MoneyInFields } from '../money-in-fields';

const Hidden = ({
  organizationId,
  order,
}: {
  organizationId: string;
  order: OrderDto;
}) => (
  <>
    <input type="hidden" name="organizationId" value={organizationId} />
    <input type="hidden" name="orderId" value={order.id} />
  </>
);

/** The steps before the handover, one touch each. */
export function StatusSteps({
  organizationId,
  order,
}: {
  organizationId: string;
  order: OrderDto;
}) {
  const [state, action, pending] = useActionState(
    setOrderStatus,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <Hidden organizationId={organizationId} order={order} />
      <FormMessage state={state} />
      <div role="group" aria-label="Étape" className="flex flex-wrap gap-2">
        {statusesFor(order.fulfilment).map((status) => (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            aria-pressed={order.status === status}
            disabled={pending}
            className={`min-h-12 rounded-full border-2 px-4 font-bold ${
              order.status === status
                ? 'border-ink bg-ink text-canvas'
                : 'border-line-strong bg-surface'
            }`}
          >
            {ORDER_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </ActionForm>
  );
}

export function DepositForm({
  organizationId,
  order,
}: {
  organizationId: string;
  order: OrderDto;
}) {
  const [state, action, pending] = useActionState(
    receiveDeposit,
    initialFormState,
  );
  // A new id after each deposit recorded: the next one is another.
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.status === 'success') setOperationId(crypto.randomUUID());
  }
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <Hidden organizationId={organizationId} order={order} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <FormField
        key={operationId}
        id="deposit-amount"
        label="Montant reçu"
        name="depositAmount"
        inputMode="numeric"
        error={state.fieldErrors?.amount}
      />
      <MoneyInFields
        prefix="deposit"
        legend="Payé par"
        errors={state.fieldErrors}
      />
      <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
        Enregistrer l’avance
      </SubmitButton>
    </ActionForm>
  );
}

/** The handover: what is left, then the sale and its ticket. */
export function DeliverForm({
  organizationId,
  order,
  currency,
  canCredit,
}: {
  organizationId: string;
  order: OrderDto;
  currency: string;
  canCredit: boolean;
}) {
  const [state, action, pending] = useActionState(
    deliverOrder,
    initialFormState,
  );
  const [method, setMethod] = useState('cash');
  const methods: PaymentMethod[] = [
    'cash',
    'mobile_money',
    'card',
    ...(canCredit ? (['credit'] as const) : []),
  ];
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <Hidden organizationId={organizationId} order={order} />
      <input type="hidden" name="remaining" value={order.remaining} />
      <FormMessage state={state} />
      {order.remaining === 0 ? (
        <p className="font-bold text-sales-ink">
          Déjà payée : rien à encaisser.
        </p>
      ) : (
        <>
          <p className="text-lg font-bold">
            À encaisser : {formatAmount(order.remaining, currency)}
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 font-semibold">Le client paie</legend>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((value) => (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 px-2 font-bold focus-within:outline-3 focus-within:outline-focus ${
                    method === value
                      ? 'border-sales-strong bg-sales-soft text-sales-ink'
                      : 'border-line-strong bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="sr-only"
                  />
                  {PAYMENT_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
          {method === 'mobile_money' && <MoneyInFieldsProvider />}
          {method === 'cash' && (
            <FormField
              id="cash-received"
              label="Le client vous donne (facultatif)"
              name="cashReceived"
              inputMode="numeric"
              error={state.fieldErrors?.cashReceived}
            />
          )}
        </>
      )}
      {state.fieldErrors?.payments && (
        <p className="font-medium text-danger-ink">
          {state.fieldErrors.payments}
        </p>
      )}
      <SubmitButton variant="sell" pendingLabel="Enregistrement…">
        Remettre au client
      </SubmitButton>
    </ActionForm>
  );
}

/** The operator of a Mobile Money payment at the handover. */
function MoneyInFieldsProvider() {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="deliver-provider" className="font-semibold">
        Opérateur
      </label>
      <select
        id="deliver-provider"
        name="provider"
        defaultValue="wave"
        className="min-h-12 w-full rounded-2xl border-2 border-line-strong bg-canvas px-4 py-2 text-base"
      >
        <option value="wave">Wave</option>
        <option value="orange_money">Orange Money</option>
        <option value="free_money">Mixx (Free Money)</option>
        <option value="other">Autre</option>
      </select>
    </div>
  );
}

/** Owner and managers: the reason, and how the deposit goes back. */
export function CancelForm({
  organizationId,
  order,
  currency,
}: {
  organizationId: string;
  order: OrderDto;
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    cancelOrder,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <Hidden organizationId={organizationId} order={order} />
      <FormMessage state={state} />
      <FormField
        id="cancel-reason"
        label="Pourquoi ?"
        name="reason"
        maxLength={300}
        error={state.fieldErrors?.reason}
      />
      {order.paid > 0 && (
        <>
          <p className="font-bold">
            À rendre au client : {formatAmount(order.paid, currency)}
          </p>
          <MoneyInFields
            prefix="refund"
            legend="Rendu par"
            errors={state.fieldErrors}
          />
        </>
      )}
      <SubmitButton variant="danger" pendingLabel="Annulation…">
        Annuler la commande
      </SubmitButton>
    </ActionForm>
  );
}
