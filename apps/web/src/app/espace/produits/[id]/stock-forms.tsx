'use client';

import { UNITS, type ProductDto, type SupplierDto } from '@nagaw/shared';
import { ClipboardCheck, PackageMinus, PackagePlus } from 'lucide-react';
import { useActionState, useState, type ReactNode } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { recordMovement } from '../actions';
import { currencySymbol } from '../product-form';

/**
 * One stock form. Each submission carries its own operation id; a new one
 * is drawn after a success, so a double tap is recorded once (ADR-020).
 */
function MovementForm({
  kind,
  organizationId,
  product,
  submitLabel,
  children,
}: {
  kind: 'purchase' | 'loss' | 'inventory';
  organizationId: string;
  product: ProductDto;
  submitLabel: string;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const [state, action, pending] = useActionState(
    recordMovement,
    initialFormState,
  );
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') setOperationId(crypto.randomUUID());
  }
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
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      {children(state.fieldErrors ?? {})}
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof PackagePlus;
  title: string;
  tone: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex min-h-16 cursor-pointer items-center gap-3 px-4 text-lg font-bold">
        <span
          className={`flex size-10 items-center justify-center rounded-xl ${tone}`}
        >
          <Icon aria-hidden className="size-6" />
        </span>
        {title}
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export function StockForms({
  organizationId,
  currency,
  product,
  suppliers,
  receiveOnly = false,
}: {
  organizationId: string;
  currency: string;
  product: ProductDto;
  suppliers: SupplierDto[];
  /** Sellers record deliveries; losses and inventories are the managers'. */
  receiveOnly?: boolean;
}) {
  const unit = UNITS[product.unit].label;
  const shared = { organizationId, product };
  return (
    <div className="flex flex-col gap-3">
      <Section
        icon={PackagePlus}
        title="J’ai reçu de la marchandise"
        tone="bg-sales-soft text-sales-ink"
      >
        <MovementForm
          kind="purchase"
          submitLabel="Ajouter au stock"
          {...shared}
        >
          {(errors) => (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label={`Quantité reçue (${unit})`}
                name="quantity"
                id="purchase-quantity"
                inputMode="decimal"
                required
                error={errors.quantity}
              />
              <FormField
                label={`Prix d’achat à l’unité (${currencySymbol(currency)}, facultatif)`}
                name="unitCost"
                id="purchase-unitCost"
                inputMode="decimal"
                error={errors.unitCost}
              />
              {suppliers.length > 0 && (
                <div className="md:col-span-2">
                  <SelectField
                    label="Fournisseur (facultatif)"
                    name="supplierId"
                    id="purchase-supplierId"
                    defaultValue=""
                    options={[
                      { value: '', label: 'Non précisé' },
                      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                    error={errors.supplierId}
                  />
                </div>
              )}
            </div>
          )}
        </MovementForm>
      </Section>

      {!receiveOnly && (
        <>
          <Section
            icon={PackageMinus}
            title="Perte, casse ou produit abîmé"
            tone="bg-danger-soft text-danger-ink"
          >
            <MovementForm
              kind="loss"
              submitLabel="Retirer du stock"
              {...shared}
            >
              {(errors) => (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label={`Quantité perdue (${unit})`}
                    name="quantity"
                    id="loss-quantity"
                    inputMode="decimal"
                    required
                    error={errors.quantity}
                  />
                  <FormField
                    label="Que s’est-il passé ?"
                    name="reason"
                    id="loss-reason"
                    placeholder="Cassé, périmé, volé…"
                    required
                    maxLength={500}
                    error={errors.reason}
                  />
                </div>
              )}
            </MovementForm>
          </Section>

          <Section
            icon={ClipboardCheck}
            title="J’ai compté ce qui reste (inventaire)"
            tone="bg-stock-soft text-stock-ink"
          >
            <MovementForm
              kind="inventory"
              submitLabel="Corriger le stock"
              {...shared}
            >
              {(errors) => (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label={`Quantité comptée (${unit})`}
                    name="countedQuantity"
                    id="inventory-countedQuantity"
                    inputMode="decimal"
                    required
                    error={errors.countedQuantity}
                  />
                  <FormField
                    label="Remarque (facultatif)"
                    name="reason"
                    id="inventory-reason"
                    maxLength={500}
                    error={errors.reason}
                  />
                </div>
              )}
            </MovementForm>
          </Section>
        </>
      )}
    </div>
  );
}
