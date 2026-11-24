'use client';

import {
  formatAmount,
  orderLineTotal,
  parseAmount,
  type CustomerDto,
  type ProductDto,
} from '@nagaw/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { CONTROL, FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/form-state';
import { parseQuantity } from '@/lib/sales/cart';
import { createOrder } from './actions';
import { MoneyInFields } from './money-in-fields';

interface Line {
  key: string;
  /** A product of the catalogue, or '' for a free line « sur mesure ». */
  productId: string;
  label: string;
  quantityText: string;
  /** For a free line, or a price agreed with the customer; '' otherwise. */
  priceText: string;
  note: string;
}

const newLine = (productId = ''): Line => ({
  key: crypto.randomUUID(),
  productId,
  label: '',
  quantityText: '1',
  priceText: '',
  note: '',
});

/** « Nouvelle commande » (ADR-072): who, what, for when, how it leaves. */
export function OrderForm({
  organizationId,
  currency,
  today,
  customers,
  products,
}: {
  organizationId: string;
  currency: string;
  today: string;
  customers: CustomerDto[];
  products: ProductDto[];
}) {
  const ids = useId();
  const money = (value: number) => formatAmount(value, currency);
  const [state, action, pending] = useActionState(
    createOrder,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  const [customerOperationId] = useState(() => crypto.randomUUID());
  const [customerId, setCustomerId] = useState(
    customers.length > 0 ? '' : 'nouveau',
  );
  const [lines, setLines] = useState<Line[]>(() => [
    newLine(products[0]?.id ?? ''),
  ]);
  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup');
  const [feeText, setFeeText] = useState('');
  const [depositText, setDepositText] = useState('');
  const errors = state.fieldErrors ?? {};
  const byId = new Map(products.map((p) => [p.id, p]));

  const priced = lines.map((line) => {
    const product = byId.get(line.productId);
    const quantity = parseQuantity(line.quantityText);
    const agreed = line.priceText.trim()
      ? parseAmount(line.priceText, currency)
      : null;
    const total =
      Number.isFinite(quantity) && quantity > 0
        ? product && !product.openPrice
          ? orderLineTotal(product.salePrice, quantity, agreed)
          : (agreed ?? 0)
        : 0;
    return { line, product, quantity, agreed, total };
  });
  const itemsTotal = priced.reduce((sum, p) => sum + p.total, 0);
  const fee =
    fulfilment === 'delivery'
      ? (parseAmount(feeText || '0', currency) ?? 0)
      : 0;
  const deposit = parseAmount(depositText || '0', currency) ?? 0;
  const total = itemsTotal + fee;

  const payload = JSON.stringify(
    priced.map(({ line, quantity, agreed }) => ({
      productId: line.productId || null,
      label: line.productId ? '' : line.label,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      agreedTotal: agreed,
      note: line.note,
    })),
  );
  const update = (key: string, change: Partial<Line>) =>
    setLines((current) =>
      current.map((l) => (l.key === key ? { ...l, ...change } : l)),
    );

  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-6"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <input
        type="hidden"
        name="customerOperationId"
        value={customerOperationId}
      />
      <input type="hidden" name="lines" value={payload} />
      <FormMessage state={state} />

      <section aria-labelledby={`${ids}-who`} className="flex flex-col gap-3">
        <h2 id={`${ids}-who`} className="text-lg font-extrabold">
          Le client
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-customer`} className="font-semibold">
            Client
          </label>
          <select
            id={`${ids}-customer`}
            name="customerId"
            value={customerId}
            onChange={(event) => setCustomerId(event.currentTarget.value)}
            aria-invalid={errors.customerId ? true : undefined}
            className={CONTROL}
          >
            {customers.length > 0 && (
              <option value="" disabled>
                Choisissez un client
              </option>
            )}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` — ${c.phone}` : ''}
              </option>
            ))}
            <option value="nouveau">Nouveau client…</option>
          </select>
          {errors.customerId && (
            <p className="font-medium text-danger-ink">{errors.customerId}</p>
          )}
        </div>
        {customerId === 'nouveau' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Nom du client"
              name="newCustomerName"
              autoComplete="off"
              error={errors.newCustomerName || undefined}
            />
            <FormField
              label="Téléphone (facultatif)"
              name="newCustomerPhone"
              inputMode="tel"
              autoComplete="off"
              error={errors.newCustomerPhone || undefined}
            />
          </div>
        )}
      </section>

      <section aria-labelledby={`${ids}-what`} className="flex flex-col gap-3">
        <h2 id={`${ids}-what`} className="text-lg font-extrabold">
          Les articles
        </h2>
        <ul className="flex flex-col gap-3">
          {priced.map(({ line, product, total: lineTotal }, index) => {
            const id = `${ids}-line-${line.key}`;
            const free = !line.productId;
            return (
              <li
                key={line.key}
                className="flex flex-col gap-3 rounded-3xl bg-surface p-4"
              >
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <label htmlFor={`${id}-product`} className="font-semibold">
                      Article {index + 1}
                    </label>
                    <select
                      id={`${id}-product`}
                      value={line.productId}
                      onChange={(event) =>
                        update(line.key, {
                          productId: event.currentTarget.value,
                          priceText: '',
                        })
                      }
                      className={CONTROL}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.openPrice ? '' : ` — ${money(p.salePrice)}`}
                        </option>
                      ))}
                      <option value="">Sur mesure (autre article)</option>
                    </select>
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) =>
                          current.filter((l) => l.key !== line.key),
                        )
                      }
                      aria-label={`Retirer l’article ${index + 1}`}
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl text-danger-ink hover:bg-danger-soft"
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  )}
                </div>
                {free && (
                  <FormField
                    id={`${id}-label`}
                    name={`label-${index}`}
                    label="Nom de l’article"
                    value={line.label}
                    maxLength={120}
                    autoComplete="off"
                    onChange={(event) =>
                      update(line.key, { label: event.currentTarget.value })
                    }
                    error={errors[`lines.${index}.label`]}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    id={`${id}-quantity`}
                    name={`quantity-${index}`}
                    label="Quantité"
                    inputMode="decimal"
                    value={line.quantityText}
                    onChange={(event) =>
                      update(line.key, {
                        quantityText: event.currentTarget.value,
                      })
                    }
                    error={errors[`lines.${index}.quantity`]}
                  />
                  <FormField
                    id={`${id}-price`}
                    name={`price-${index}`}
                    label={
                      free || product?.openPrice
                        ? 'Prix de la ligne'
                        : 'Prix convenu (facultatif)'
                    }
                    inputMode="numeric"
                    value={line.priceText}
                    placeholder={
                      free || product?.openPrice ? '' : money(lineTotal)
                    }
                    onChange={(event) =>
                      update(line.key, { priceText: event.currentTarget.value })
                    }
                    error={errors[`lines.${index}.agreedTotal`]}
                  />
                </div>
                <FormField
                  id={`${id}-note`}
                  name={`note-${index}`}
                  label="Note (facultatif)"
                  hint="Mesures, couleur, texte sur le gâteau…"
                  value={line.note}
                  maxLength={300}
                  autoComplete="off"
                  onChange={(event) =>
                    update(line.key, { note: event.currentTarget.value })
                  }
                />
                <p className="text-right font-bold tabular-nums">
                  {money(lineTotal)}
                </p>
              </li>
            );
          })}
        </ul>
        {errors.lines && (
          <p className="font-medium text-danger-ink">{errors.lines}</p>
        )}
        <button
          type="button"
          onClick={() =>
            setLines((current) => [...current, newLine(products[0]?.id ?? '')])
          }
          className={`${buttonClasses('secondary')} self-start`}
        >
          <Plus aria-hidden className="size-5" />
          Ajouter un article
        </button>
      </section>

      <section aria-labelledby={`${ids}-when`} className="flex flex-col gap-3">
        <h2 id={`${ids}-when`} className="text-lg font-extrabold">
          Pour quand
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Date"
            name="dueOn"
            type="date"
            defaultValue={today}
            error={errors.dueOn}
          />
          <FormField
            label="Heure (facultatif)"
            name="dueTime"
            type="time"
            error={errors.dueTime}
          />
        </div>
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-lg font-extrabold">
          Comment le client la reçoit
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'pickup', label: 'Il vient la chercher' },
              { value: 'delivery', label: 'Livraison' },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex min-h-12 cursor-pointer items-center rounded-xl border-2 px-3 py-2 font-bold focus-within:outline-3 focus-within:outline-focus ${
                fulfilment === option.value
                  ? 'border-ink bg-canvas'
                  : 'border-line-strong bg-surface'
              }`}
            >
              <input
                type="radio"
                name="fulfilment"
                value={option.value}
                checked={fulfilment === option.value}
                onChange={() => setFulfilment(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {fulfilment === 'delivery' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormField
                label="Adresse ou quartier"
                name="deliveryAddress"
                maxLength={200}
                error={errors.deliveryAddress}
              />
            </div>
            <FormField
              label="Repère (facultatif)"
              name="deliveryLandmark"
              maxLength={200}
            />
            <FormField
              label="Téléphone sur place (facultatif)"
              name="deliveryPhone"
              inputMode="tel"
              maxLength={30}
            />
            <FormField
              label="Frais de livraison (facultatif)"
              name="deliveryFee"
              inputMode="numeric"
              value={feeText}
              onChange={(event) => setFeeText(event.currentTarget.value)}
              error={errors.deliveryFee}
            />
          </div>
        )}
        <FormField label="Note (facultatif)" name="note" maxLength={500} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-lg font-extrabold">
          Avance (facultatif)
        </legend>
        <FormField
          label="Le client paie maintenant"
          name="depositAmount"
          inputMode="numeric"
          hint="Tout, une partie ou rien : le reste se paie à la remise."
          value={depositText}
          onChange={(event) => setDepositText(event.currentTarget.value)}
          error={errors['deposit.amount']}
        />
        {deposit > 0 && (
          <MoneyInFields prefix="deposit" errors={errors} legend="Payée par" />
        )}
      </fieldset>

      <dl className="flex flex-col gap-1 rounded-2xl bg-sales-soft p-4 text-sales-ink">
        {fee > 0 && (
          <div className="flex justify-between gap-2">
            <dt>Articles</dt>
            <dd className="tabular-nums">{money(itemsTotal)}</dd>
          </div>
        )}
        {fee > 0 && (
          <div className="flex justify-between gap-2">
            <dt>Livraison</dt>
            <dd className="tabular-nums">{money(fee)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2 text-xl font-extrabold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(total)}</dd>
        </div>
        {deposit > 0 && (
          <div className="flex justify-between gap-2 font-bold">
            <dt>Reste à payer</dt>
            <dd className="tabular-nums">
              {money(Math.max(total - deposit, 0))}
            </dd>
          </div>
        )}
      </dl>

      <SubmitButton pendingLabel="Enregistrement…">
        Enregistrer la commande
      </SubmitButton>
    </ActionForm>
  );
}
