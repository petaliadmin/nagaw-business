'use client';

import { MOBILE_MONEY_PROVIDERS, type OrderDto } from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import { PROVIDER_LABELS } from '@/lib/sales/labels';
import {
  cancelOrder,
  checkWavePayment,
  confirmOrder,
  deliverOrder,
  payOrder,
  shipOrder,
} from '../actions';

interface Props {
  organizationId: string;
  order: OrderDto;
  currency: string;
}

function Ids({ organizationId, order }: Omit<Props, 'currency'>) {
  return (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="orderId" value={order.id} />
    </>
  );
}

/** Cash, or one of the Mobile Money operators. */
function PaymentChoice({ error }: { error?: string }) {
  const choices = [
    { value: 'cash', label: 'Espèces' },
    ...MOBILE_MONEY_PROVIDERS.map((provider) => ({
      value: provider,
      label: PROVIDER_LABELS[provider],
    })),
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-base font-semibold">
        Comment le client a payé
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong bg-surface px-3 text-base font-semibold has-[:checked]:border-brand-strong has-[:checked]:bg-brand-soft"
          >
            <input
              type="radio"
              name="payment"
              value={choice.value}
              required
              className="size-5 accent-brand-strong"
            />
            {choice.label}
          </label>
        ))}
      </div>
      <FormField
        label="Numéro de la transaction (facultatif)"
        name="reference"
        maxLength={60}
      />
      {error && (
        <p role="alert" className="text-base font-medium text-danger-ink">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ConfirmOrder(props: Props) {
  const [state, action, pending] = useActionState(
    confirmOrder,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-3"
    >
      <FormMessage state={state} />
      <Ids {...props} />
      <SubmitButton pendingLabel="Confirmation…">
        Confirmer la commande
      </SubmitButton>
    </ActionForm>
  );
}

export function ShipOrder(props: Props) {
  const [state, action, pending] = useActionState(shipOrder, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <FormMessage state={state} />
      <Ids {...props} />
      <input type="hidden" name="currency" value={props.currency} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Nom du livreur"
          name="courierName"
          maxLength={120}
          defaultValue={props.order.courierName}
          error={errors.courierName}
        />
        <FormField
          label="Téléphone du livreur"
          name="courierPhone"
          type="tel"
          inputMode="tel"
          maxLength={30}
          error={errors.courierPhone}
        />
      </div>
      <FormField
        label="Frais de livraison, payés au livreur"
        name="deliveryFee"
        inputMode="numeric"
        placeholder="0"
        hint="Ils ne comptent pas dans la vente."
        error={errors.deliveryFee}
      />
      <SubmitButton pendingLabel="Envoi…">Envoyer en livraison</SubmitButton>
    </ActionForm>
  );
}

export function DeliverOrder({
  primary,
  ...props
}: Props & { primary: boolean }) {
  const [state, action, pending] = useActionState(
    deliverOrder,
    initialFormState,
  );
  const paid = props.order.paidAt !== null;
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
    >
      <FormMessage state={state} />
      <Ids {...props} />
      {paid ? (
        <input type="hidden" name="paid" value="on" />
      ) : (
        <PaymentChoice error={state.fieldErrors?.payment} />
      )}
      <SubmitButton
        pendingLabel="Enregistrement…"
        variant={primary ? 'sell' : 'secondary'}
      >
        Marquer livrée
      </SubmitButton>
    </ActionForm>
  );
}

/** Paid before the delivery: in a sheet, not the main action. */
export function PayOrder(props: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(payOrder, initialFormState);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses('secondary')}
      >
        Le client a payé
      </button>
      <BottomSheet
        open={open}
        title="Paiement reçu"
        onClose={() => setOpen(false)}
      >
        <ActionForm
          action={action}
          pending={pending}
          className="flex flex-col gap-4"
        >
          <FormMessage state={state} />
          <Ids {...props} />
          <PaymentChoice error={state.fieldErrors?.payment} />
          <SubmitButton pendingLabel="Enregistrement…">
            Enregistrer le paiement
          </SubmitButton>
        </ActionForm>
      </BottomSheet>
    </>
  );
}

export function CancelOrder(props: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    cancelOrder,
    initialFormState,
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses('secondary', 'text-danger-ink')}
      >
        Annuler la commande
      </button>
      <BottomSheet
        open={open}
        title="Annuler la commande"
        onClose={() => setOpen(false)}
      >
        <ActionForm
          action={action}
          pending={pending}
          className="flex flex-col gap-4"
        >
          <FormMessage state={state} />
          <Ids {...props} />
          <FormField
            label="Pourquoi ?"
            name="reason"
            required
            maxLength={500}
            hint="Par exemple : client injoignable, article épuisé."
            error={state.fieldErrors?.reason}
          />
          <SubmitButton pendingLabel="Annulation…" variant="danger">
            Annuler la commande
          </SubmitButton>
        </ActionForm>
      </BottomSheet>
    </>
  );
}

/** Asks Wave again, for an order whose customer opened the Wave page. */
export function CheckWavePayment(props: Props) {
  const [state, action, pending] = useActionState(
    checkWavePayment,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-2"
    >
      <FormMessage state={state} />
      <Ids {...props} />
      <SubmitButton pendingLabel="Question à Wave…" variant="secondary">
        Vérifier le paiement Wave
      </SubmitButton>
    </ActionForm>
  );
}
