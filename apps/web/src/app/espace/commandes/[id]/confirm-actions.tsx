'use client';

import {
  DECLINE_REASON_LABELS,
  DECLINE_REASONS,
  formatAmount,
  type OrderDto,
} from '@nagaw/shared';
import { MessageCircle } from 'lucide-react';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/form-state';
import { dueLabel, orderPerson } from '@/lib/orders';
import { whatsappLink } from '@/lib/sales/ticket';
import { acceptOrder, declineOrder, rescheduleOrder } from '../actions';

const Hidden = ({
  organizationId,
  orderId,
}: {
  organizationId: string;
  orderId: string;
}) => (
  <>
    <input type="hidden" name="organizationId" value={organizationId} />
    <input type="hidden" name="orderId" value={orderId} />
  </>
);

const PILL =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2 has-checked:border-brand-strong has-checked:bg-brand-soft has-checked:text-brand-ink border-line-strong';

/**
 * An order sent from the storefront (ADR-075): accept it, propose another
 * day, or refuse it. Nothing is sent by Nagaw: « Prévenir sur WhatsApp »
 * opens a message already written.
 */
export function ConfirmActions({
  organizationId,
  order,
  currency,
  shopName,
  countryCode,
  match,
  canDecline,
}: {
  organizationId: string;
  order: OrderDto;
  currency: string;
  shopName: string;
  countryCode: string;
  /** A customer of the shop with the same number, proposed first. */
  match: { id: string; name: string } | null;
  canDecline: boolean;
}) {
  const [accepted, accept, accepting] = useActionState(
    acceptOrder,
    initialFormState,
  );
  const [moved, move, moving] = useActionState(
    rescheduleOrder,
    initialFormState,
  );
  const [declined, decline, declining] = useActionState(
    declineOrder,
    initialFormState,
  );
  const [reason, setReason] = useState<string>('');
  const person = orderPerson(order);
  const money = (value: number) => formatAmount(value, currency);
  const toPrice = order.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.priceToSet);
  const firstName = person.name.split(/\s+/)[0] ?? '';
  const askDay = whatsappLink(
    `Bonjour ${firstName}, merci pour votre commande ${order.number} chez ${shopName}. Pouvez-vous passer le ${dueLabel(order)} ?`,
    person.phone,
    countryCode,
  );

  return (
    <div className="flex flex-col gap-4">
      <ActionForm
        action={accept}
        pending={accepting}
        className="flex flex-col gap-4"
      >
        <Hidden organizationId={organizationId} orderId={order.id} />
        <FormMessage state={accepted} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">Client</legend>
          {match && (
            <label className={PILL}>
              <input
                type="radio"
                name="customer"
                value={match.id}
                defaultChecked
                className="size-5 accent-brand-strong"
              />
              <span>
                <strong>Déjà client</strong> · {match.name}
              </span>
            </label>
          )}
          <label className={PILL}>
            <input
              type="radio"
              name="customer"
              value="nouveau"
              defaultChecked={!match}
              className="size-5 accent-brand-strong"
            />
            <span>
              <strong>Nouveau client</strong> · {person.name}
              {person.phone ? `, ${person.phone}` : ''}
            </span>
          </label>
        </fieldset>
        {toPrice.map(({ line, index }) => (
          <div key={index}>
            <input type="hidden" name="priceLine" value={index} />
            <FormField
              label={`Prix de « ${line.label} » × ${String(line.quantity).replace('.', ',')}`}
              name={`price-${index}`}
              inputMode="numeric"
              required
              hint="Le client l’a demandé : tapez le prix de la ligne."
              error={accepted.fieldErrors?.[`prices.${index}`]}
            />
          </div>
        ))}
        <p className="text-ink-muted">
          Retrait le {dueLabel(order)} à la boutique. Le client paie en venant
          chercher : {money(order.total)}
          {toPrice.length > 0 ? ' + les prix à taper' : ''}.
        </p>
        <SubmitButton pendingLabel="Acceptation…">
          Accepter la commande
        </SubmitButton>
      </ActionForm>

      <details className="rounded-3xl bg-surface p-4">
        <summary className="flex min-h-12 cursor-pointer items-center font-bold">
          Proposer un autre jour
        </summary>
        <ActionForm
          action={move}
          pending={moving}
          className="mt-3 flex flex-col gap-3"
        >
          <Hidden organizationId={organizationId} orderId={order.id} />
          <FormMessage state={moved} />
          <FormField
            label="Jour"
            name="dueOn"
            type="date"
            required
            defaultValue={order.dueOn}
            error={moved.fieldErrors?.dueOn}
          />
          <FormField
            label="Heure (facultatif)"
            name="dueTime"
            type="time"
            defaultValue={order.dueTime ?? ''}
            error={moved.fieldErrors?.dueTime}
          />
          <SubmitButton pendingLabel="Enregistrement…" variant="secondary">
            Enregistrer ce jour
          </SubmitButton>
        </ActionForm>
        <a
          href={askDay}
          target="_blank"
          rel="noreferrer"
          className={`${buttonClasses('secondary')} mt-3 w-full bg-canvas`}
        >
          <MessageCircle aria-hidden className="size-5" />
          Demander au client sur WhatsApp
        </a>
      </details>

      {canDecline && (
        <details className="rounded-3xl bg-surface p-4">
          <summary className="flex min-h-12 cursor-pointer items-center font-bold text-danger-ink">
            Refuser la commande
          </summary>
          <ActionForm
            action={decline}
            pending={declining}
            className="mt-3 flex flex-col gap-3"
          >
            <Hidden organizationId={organizationId} orderId={order.id} />
            <FormMessage state={declined} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-bold">Pourquoi ?</legend>
              <div className="flex flex-wrap gap-2">
                {DECLINE_REASONS.map((value) => (
                  <label key={value} className={PILL}>
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      required
                      onChange={() => setReason(value)}
                      className="size-5 accent-brand-strong"
                    />
                    {DECLINE_REASON_LABELS[value]}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField
              label={
                reason === 'other' ? 'Dites pourquoi' : 'Un mot (facultatif)'
              }
              name="detail"
              maxLength={200}
              required={reason === 'other'}
              error={declined.fieldErrors?.detail}
            />
            <SubmitButton pendingLabel="Refus…" variant="danger">
              Refuser la commande
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
