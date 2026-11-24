'use client';

import {
  amountInputValue,
  formatRate,
  type CategoryDto,
  type ProductDto,
  type ProductKind,
  type ShopOffer,
  type TaxRateDto,
} from '@nagaw/shared';
import { Package, Wrench } from 'lucide-react';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { PhotoField } from '@/components/catalog/photo-field';
import { productPhotoUrl } from '@/components/catalog/product-tile';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/auth/form-state';
import { GOODS_UNIT_OPTIONS, SERVICE_UNIT_OPTIONS } from '@/lib/catalog/labels';
import { createProduct, updateProduct } from './actions';

const KINDS = [
  { value: 'product', label: 'Un produit', icon: Package },
  { value: 'service', label: 'Un service', icon: Wrench },
] as const;

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
  offer,
  countsStockByDefault = true,
  organizationId,
  currency,
  categories,
  taxRates,
  product,
  prefill,
  countStock = false,
}: {
  offer: ShopOffer;
  /** Whether a new product counts its stock at first (ADR-067). */
  countsStockByDefault?: boolean;
  organizationId: string;
  currency: string;
  /** Active categories and tax rates of the shop. */
  categories: CategoryDto[];
  taxRates: TaxRateDto[];
  /** Absent on creation. */
  product?: ProductDto;
  /** What the caisse typed for « Taper un montant » (ADR-069). */
  prefill?: { name: string; salePrice: number | null };
  /** « Compter son stock » from the home page (ADR-070). */
  countStock?: boolean;
}) {
  const [state, action, pending] = useActionState(
    product ? updateProduct : createProduct,
    initialFormState,
  );
  // One id per creation attempt: a double tap never creates two products.
  const [operationId] = useState(() => crypto.randomUUID());
  const [trackStock, setTrackStock] = useState(
    countStock || (product?.trackStock ?? countsStockByDefault),
  );
  const [kind, setKind] = useState<ProductKind>(
    product?.kind ?? (offer === 'services' ? 'service' : 'product'),
  );
  // A price that changes with the customer or the heap (ADR-069).
  const [openPrice, setOpenPrice] = useState(product?.openPrice ?? false);
  const service = kind === 'service';
  const noun = service ? 'service' : 'produit';
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

      {offer === 'both' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-base font-semibold">
            Que vendez-vous ?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-base font-bold focus-within:outline-3 focus-within:outline-focus ${
                  kind === value
                    ? 'border-stock-strong bg-stock-soft text-stock-ink'
                    : 'border-line-strong bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-5 shrink-0" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}

      {/* V3 « Nouveau produit »: photo, name, two prices, stock and unit;
          the rest folded (ADR-063). */}
      <PhotoField
        currentUrl={product ? productPhotoUrl(product) : null}
        error={errors.photo}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField
            label={`Nom du ${noun}`}
            name="name"
            defaultValue={product?.name ?? prefill?.name}
            required
            maxLength={120}
            autoComplete="off"
            error={errors.name}
          />
        </div>
        <fieldset className="flex flex-col gap-2 md:col-span-2">
          <legend className="mb-1.5 text-base font-semibold">
            Le prix de vente
          </legend>
          <input
            type="hidden"
            name="openPrice"
            value={openPrice ? 'true' : 'false'}
          />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: false, label: 'Toujours le même' },
                { value: true, label: 'Tapé à chaque vente' },
              ] as const
            ).map((option) => (
              <label
                key={String(option.value)}
                className={`flex min-h-12 cursor-pointer items-center rounded-xl border-2 px-3 py-2 text-base font-bold focus-within:outline-3 focus-within:outline-focus ${
                  openPrice === option.value
                    ? 'border-stock-strong bg-stock-soft text-stock-ink'
                    : 'border-line-strong bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="priceMode"
                  checked={openPrice === option.value}
                  onChange={() => setOpenPrice(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          {openPrice && (
            <p className="text-ink-muted">
              À la caisse, le vendeur tape le prix à chaque vente : pour le
              poisson, les tas d’oignons, ce qui change selon le client.
            </p>
          )}
        </fieldset>
        <FormField
          key={openPrice ? 'open' : 'fixed'}
          label={
            openPrice
              ? `Prix habituel (${symbol}, facultatif)`
              : `Prix de vente (${symbol})`
          }
          name="salePrice"
          inputMode="decimal"
          defaultValue={
            product
              ? product.openPrice && product.salePrice === 0
                ? ''
                : amountInputValue(product.salePrice, currency)
              : prefill?.salePrice != null
                ? amountInputValue(prefill.salePrice, currency)
                : undefined
          }
          required={!openPrice}
          error={errors.salePrice}
        />
        <FormField
          label={`${service ? 'Ce qu’il vous coûte' : 'Prix d’achat'} (${symbol})`}
          name="purchasePrice"
          inputMode="decimal"
          hint="Pour calculer votre bénéfice"
          defaultValue={
            product?.purchasePrice != null
              ? amountInputValue(product.purchasePrice, currency)
              : undefined
          }
          error={errors.purchasePrice}
        />
        {!service && trackStock && !product && (
          <FormField
            label="En stock"
            name="initialStock"
            inputMode="decimal"
            placeholder="0"
            error={errors.initialStock}
          />
        )}
        {/* A new list of units: the choice starts again with the first. */}
        <SelectField
          key={kind}
          label={service ? 'Facturé à' : 'Unité'}
          name="unit"
          defaultValue={
            product?.kind === kind
              ? product.unit
              : service
                ? 'prestation'
                : 'piece'
          }
          options={service ? SERVICE_UNIT_OPTIONS : GOODS_UNIT_OPTIONS}
          error={errors.unit}
        />
      </div>

      <details
        className="rounded-3xl bg-surface p-4"
        open={Boolean(
          (countStock && !product?.trackStock) ||
          errors.categoryId ||
          errors.taxRateId ||
          errors.barcode ||
          errors.lowStockThreshold,
        )}
      >
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-bold">
          {service
            ? 'Catégorie et taxe'
            : 'Code-barres, catégorie, seuil d’alerte'}
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {!service && (
            <FormField
              label="Code-barres"
              name="barcode"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={product?.barcode ?? ''}
              error={errors.barcode}
            />
          )}
          <SelectField
            label="Catégorie"
            name="categoryId"
            defaultValue={product?.category?.id ?? ''}
            options={categoryOptions}
            error={errors.categoryId}
          />
          {!service && (
            <div className="flex flex-col gap-4 md:col-span-2">
              <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
                <input
                  type="checkbox"
                  name="trackStock"
                  checked={trackStock}
                  onChange={(event) =>
                    setTrackStock(event.currentTarget.checked)
                  }
                  className="size-6 accent-brand-strong"
                />
                Suivre le stock de ce produit
              </label>
              {trackStock ? (
                <FormField
                  label="Me prévenir quand il en reste"
                  name="lowStockThreshold"
                  inputMode="decimal"
                  defaultValue={quantityText(
                    product?.lowStockThreshold ?? null,
                  )}
                  error={errors.lowStockThreshold}
                />
              ) : (
                <p className="text-ink-muted">
                  Pour les produits que vous ne comptez pas.
                </p>
              )}
            </div>
          )}
          <SelectField
            label="Taxe comprise dans le prix"
            name="taxRateId"
            defaultValue={product?.taxRate?.id ?? ''}
            options={taxOptions}
            error={errors.taxRateId}
          />
        </div>
      </details>

      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {product ? 'Enregistrer les modifications' : `Enregistrer le ${noun}`}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
