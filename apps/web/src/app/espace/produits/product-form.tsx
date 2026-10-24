'use client';

import {
  amountInputValue,
  formatRate,
  type CategoryDto,
  type ProductDto,
  type TaxRateDto,
} from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { PhotoField } from '@/components/catalog/photo-field';
import { productPhotoUrl } from '@/components/catalog/product-tile';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/schemas';
import { UNIT_OPTIONS } from '@/lib/catalog/labels';
import { createProduct, updateProduct } from './actions';

/** `F CFA`, `€`: the symbol shown next to amount fields. */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat('fr', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}

const quantityText = (value: number | null) =>
  value === null ? '' : String(value).replace('.', ',');

export function ProductForm({
  organizationId,
  currency,
  categories,
  taxRates,
  product,
}: {
  organizationId: string;
  currency: string;
  /** Active categories and tax rates of the shop. */
  categories: CategoryDto[];
  taxRates: TaxRateDto[];
  /** Absent on creation. */
  product?: ProductDto;
}) {
  const [state, action, pending] = useActionState(
    product ? updateProduct : createProduct,
    initialFormState,
  );
  // One id per creation attempt: a double tap never creates two products.
  const [operationId] = useState(() => crypto.randomUUID());
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? true);
  const symbol = currencySymbol(currency);
  const errors = state.fieldErrors ?? {};

  // A product may use a category or tax rate archived since: keep it listed.
  const categoryOptions = [
    { value: '', label: 'Sans catégorie' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    ...(product?.category &&
    !categories.some((c) => c.id === product.category?.id)
      ? [
          {
            value: product.category.id,
            label: `${product.category.name} (archivée)`,
          },
        ]
      : []),
  ];
  const taxOptions = [
    { value: '', label: 'Pas de taxe' },
    ...taxRates.map((t) => ({
      value: t.id,
      label: `${t.name} — ${formatRate(t.rateBasisPoints)}`,
    })),
    ...(product?.taxRate && !taxRates.some((t) => t.id === product.taxRate?.id)
      ? [
          {
            value: product.taxRate.id,
            label: `${product.taxRate.name} (archivée)`,
          },
        ]
      : []),
  ];

  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col gap-6"
      noValidate
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      {product ? (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="version" value={product.version} />
        </>
      ) : (
        <input type="hidden" name="clientOperationId" value={operationId} />
      )}
      <FormMessage state={state} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField
            label="Nom du produit"
            name="name"
            defaultValue={product?.name}
            required
            maxLength={120}
            autoComplete="off"
            error={errors.name}
          />
        </div>
        <FormField
          label={`Prix de vente (${symbol})`}
          name="salePrice"
          inputMode="decimal"
          defaultValue={
            product ? amountInputValue(product.salePrice, currency) : undefined
          }
          required
          error={errors.salePrice}
        />
        <SelectField
          label="Vendu à la"
          name="unit"
          defaultValue={product?.unit ?? 'piece'}
          options={UNIT_OPTIONS}
          error={errors.unit}
        />
        <div className="md:col-span-2">
          <SelectField
            label="Catégorie"
            name="categoryId"
            defaultValue={product?.category?.id ?? ''}
            options={categoryOptions}
            error={errors.categoryId}
          />
        </div>
      </div>

      <PhotoField
        currentUrl={product ? productPhotoUrl(product) : null}
        error={errors.photo}
      />

      <fieldset className="flex flex-col gap-4 rounded-2xl bg-surface-muted p-4">
        <legend className="sr-only">Stock</legend>
        <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
          <input
            type="checkbox"
            name="trackStock"
            checked={trackStock}
            onChange={(event) => setTrackStock(event.currentTarget.checked)}
            className="size-6 accent-brand-strong"
          />
          Suivre le stock de ce produit
        </label>
        {trackStock && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!product && (
              <FormField
                label="Quantité en stock aujourd’hui"
                name="initialStock"
                inputMode="decimal"
                placeholder="0"
                error={errors.initialStock}
              />
            )}
            <FormField
              label="Me prévenir quand il en reste"
              name="lowStockThreshold"
              inputMode="decimal"
              defaultValue={quantityText(product?.lowStockThreshold ?? null)}
              error={errors.lowStockThreshold}
            />
          </div>
        )}
        {!trackStock && (
          <p className="text-ink-muted">
            Pour les services ou les produits que vous ne comptez pas.
          </p>
        )}
      </fieldset>

      <details
        className="rounded-2xl border border-line p-4"
        open={Boolean(
          errors.purchasePrice || errors.taxRateId || errors.barcode,
        )}
      >
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-bold">
          Plus de détails : prix d’achat, taxe, code-barres
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label={`Prix d’achat (${symbol})`}
            name="purchasePrice"
            inputMode="decimal"
            defaultValue={
              product?.purchasePrice != null
                ? amountInputValue(product.purchasePrice, currency)
                : undefined
            }
            error={errors.purchasePrice}
          />
          <SelectField
            label="Taxe comprise dans le prix"
            name="taxRateId"
            defaultValue={product?.taxRate?.id ?? ''}
            options={taxOptions}
            error={errors.taxRateId}
          />
          <FormField
            label="Code-barres"
            name="barcode"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={product?.barcode ?? ''}
            error={errors.barcode}
          />
        </div>
      </details>

      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {product ? 'Enregistrer les modifications' : 'Enregistrer le produit'}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
