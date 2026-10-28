'use client';

import {
  displayPriceOf,
  formatAmount,
  sellingOptionsOf,
  UNITS,
  type ProductDto,
  type ProductUnitDto,
  type UnitTemplateDto,
} from '@nagaw/shared';
import { Scale } from 'lucide-react';
import { useActionState, useId, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { Card } from '@/components/ui/card';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { addProductUnit, updateProductUnit } from '../actions';

const quantity = (value: number) =>
  new Intl.NumberFormat('fr', { maximumFractionDigits: 3 }).format(value);

/**
 * One change of a selling unit: its price (empty: priced from the stock
 * unit) or taking it off sale.
 */
function UnitChangeForm({
  organizationId,
  product,
  unit,
  currency,
  intent,
}: {
  organizationId: string;
  product: ProductDto;
  unit: ProductUnitDto;
  currency: string;
  intent: 'price' | 'archive';
}) {
  const [state, action, pending] = useActionState(
    updateProductUnit,
    initialFormState,
  );
  const ids = useId();
  const computed = displayPriceOf({ ...unit, price: null }, product.salePrice);
  return (
    <ActionForm
      action={action}
      pending={pending}
      onSubmitCapture={(event) => {
        if (
          intent === 'archive' &&
          !window.confirm(
            `Retirer « ${unit.label} » ? Elle ne sera plus proposée à la caisse ; les ventes passées la gardent.`,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className="flex flex-col gap-2"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="unitId" value={unit.id} />
      <input type="hidden" name="version" value={unit.version} />
      <input type="hidden" name="intent" value={intent} />
      <FormMessage state={state} />
      {intent === 'price' ? (
        <>
          <FormField
            id={`${ids}-price`}
            label={`Prix d’un ${unit.label}`}
            name="salePrice"
            inputMode="numeric"
            defaultValue={unit.salePrice ?? ''}
            hint={`Laissez vide pour le prix calculé : ${formatAmount(computed, currency)}.`}
            error={state.fieldErrors?.salePrice}
          />
          <div>
            <SubmitButton pendingLabel="Enregistrement…">
              Enregistrer le prix
            </SubmitButton>
          </div>
        </>
      ) : (
        <div>
          <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
            Retirer cette unité
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

function AddUnitForm({
  organizationId,
  product,
  currency,
  templates,
}: {
  organizationId: string;
  product: ProductDto;
  currency: string;
  templates: UnitTemplateDto[];
}) {
  const [state, action, pending] = useActionState(
    addProductUnit,
    initialFormState,
  );
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [handled, setHandled] = useState<FormState>(state);
  const [values, setValues] = useState({
    label: '',
    factor: '',
    allowsDecimals: false,
  });
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') {
      setOperationId(crypto.randomUUID());
      setValues({ label: '', factor: '', allowsDecimals: false });
    }
  }
  const ids = useId();
  const stockUnit = UNITS[product.unit].label;
  const factor = Number(values.factor.replace(',', '.'));
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm
      key={operationId}
      action={action}
      pending={pending}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      {templates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-template`} className="font-semibold">
            Partir d’un modèle de la boutique (facultatif)
          </label>
          <select
            id={`${ids}-template`}
            defaultValue=""
            onChange={(event) => {
              const template = templates.find(
                (t) => t.id === event.currentTarget.value,
              );
              if (template)
                setValues({
                  label: template.label,
                  factor: quantity(template.factor),
                  allowsDecimals: template.allowsDecimals,
                });
            }}
            className="min-h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-2 text-base"
          >
            <option value="">Aucun modèle</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label} ({quantity(template.factor)} {stockUnit})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          id={`${ids}-label`}
          label="Nom de l’unité"
          name="label"
          value={values.label}
          onChange={(event) =>
            setValues({ ...values, label: event.currentTarget.value })
          }
          maxLength={60}
          placeholder="Sac de 50 kg, demi-kilo, paquet…"
          error={errors.label}
        />
        <FormField
          id={`${ids}-factor`}
          label={`Combien de ${stockUnit} dans une unité ?`}
          name="factor"
          inputMode="decimal"
          value={values.factor}
          onChange={(event) =>
            setValues({ ...values, factor: event.currentTarget.value })
          }
          hint="Plus petit que 1 pour une fraction : 0,5 pour un demi. Ce nombre ne pourra plus changer."
          error={errors.factor}
        />
        <FormField
          id={`${ids}-price`}
          label="Prix de vente de cette unité (facultatif)"
          name="salePrice"
          inputMode="numeric"
          hint={
            factor > 0
              ? `Vide : prix calculé, ${formatAmount(Math.round(product.salePrice * factor), currency)}.`
              : `Vide : prix du ${stockUnit} × la quantité.`
          }
          error={errors.salePrice}
        />
        <FormField
          id={`${ids}-barcode`}
          label="Code-barres de cette unité (facultatif)"
          name="barcode"
          inputMode="numeric"
          error={errors.barcode}
        />
      </div>
      <label className="flex min-h-12 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          name="allowsDecimals"
          checked={values.allowsDecimals}
          onChange={(event) =>
            setValues({
              ...values,
              allowsDecimals: event.currentTarget.checked,
            })
          }
          className="size-12 shrink-0 accent-brand-strong"
        />
        Se vend aussi en partie (1,5 par exemple)
      </label>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Ajouter l’unité
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * What the product is sold in at the counter (ADR-038): its stock unit,
 * the automatic conversions and its own selling units.
 */
export function UnitsSection({
  organizationId,
  product,
  currency,
  templates,
  canManage,
}: {
  organizationId: string;
  product: ProductDto;
  currency: string;
  templates: UnitTemplateDto[];
  canManage: boolean;
}) {
  const money = (value: number) => formatAmount(value, currency);
  const stockUnit = UNITS[product.unit].label;
  const options = sellingOptionsOf(product);
  return (
    <Card title="Unités de vente" titleId="units" icon={Scale}>
      <p className="text-ink-muted">
        Le stock est compté en {stockUnit}. À la caisse, le vendeur choisit
        l’unité ; le stock baisse toujours dans la bonne quantité.
      </p>
      <ul
        aria-label="Unités de vente"
        className="flex flex-col divide-y divide-line"
      >
        {options.map((option) => {
          const unit = product.units.find((u) => u.id === option.productUnitId);
          return (
            <li key={option.key} className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {option.label ?? stockUnit}
                  {option.key !== 'stock' && (
                    <span className="block font-normal text-ink-muted">
                      = {quantity(option.factor)} {stockUnit}
                      {option.conversion ? ' · automatique' : ''}
                    </span>
                  )}
                </span>
                <span className="text-lg font-extrabold tabular-nums">
                  {option.key === 'stock'
                    ? 'Prix de la fiche'
                    : option.price !== null
                      ? money(option.price)
                      : option.factor < 1
                        ? `au prix du ${stockUnit}`
                        : `${money(displayPriceOf(option, product.salePrice))} (calculé)`}
                </span>
              </div>
              {unit && canManage && product.status === 'active' && (
                <details className="rounded-xl bg-surface-muted p-3">
                  <summary className="flex min-h-12 cursor-pointer items-center font-bold">
                    Changer le prix ou retirer
                  </summary>
                  <div className="mt-2 flex flex-col gap-4">
                    <UnitChangeForm
                      organizationId={organizationId}
                      product={product}
                      unit={unit}
                      currency={currency}
                      intent="price"
                    />
                    <UnitChangeForm
                      organizationId={organizationId}
                      product={product}
                      unit={unit}
                      currency={currency}
                      intent="archive"
                    />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {canManage && product.status === 'active' && (
        <details className="rounded-2xl border border-line">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 text-lg font-bold">
            Ajouter une unité de vente
          </summary>
          <div className="border-t border-line p-4">
            <AddUnitForm
              organizationId={organizationId}
              product={product}
              currency={currency}
              templates={templates.filter((t) => t.stockUnit === product.unit)}
            />
          </div>
        </details>
      )}
    </Card>
  );
}
