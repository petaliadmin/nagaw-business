'use client';

import {
  amountInputValue,
  computeDocumentTotals,
  formatAmount,
  formatRate,
  parseAmount,
  type Unit,
} from '@nagaw/shared';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { CONTROL } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { initialFormState } from '@/lib/auth/schemas';
import { UNIT_OPTIONS } from '@/lib/catalog/labels';
import { saveInvoice, saveQuote } from './actions';

export interface EditorProduct {
  id: string;
  name: string;
  unit: Unit;
  salePrice: number;
  taxRateBasisPoints: number | null;
}

export interface EditorDocument {
  customerId: string;
  lines: {
    productId: string | null;
    label: string;
    unit: Unit;
    quantity: number;
    unitPrice: number;
    taxRateBasisPoints: number | null;
  }[];
  discount: number;
  notes: string;
  /** Quote: valid until; invoice: due date (empty: the shop's term). */
  date: string;
}

interface LineState {
  key: string;
  productId: string | null;
  label: string;
  unit: Unit;
  quantity: string;
  unitPrice: string;
  taxRateBasisPoints: number | null;
}

const LABEL = 'text-base font-semibold';
const ERROR = 'text-base font-medium text-danger-ink';

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className={ERROR}>
      {error}
    </p>
  ) : null;
}

/**
 * Quote or invoice editor: lines from the catalogue or free (a service),
 * prices taxes included as at the counter, totals computed as the server
 * will (ADR-026). The server numbers the document and checks everything.
 */
export function DocumentEditor({
  kind,
  organizationId,
  currency,
  customers,
  products,
  taxRates,
  initial,
  documentId,
}: {
  kind: 'quote' | 'invoice';
  organizationId: string;
  currency: string;
  customers: { id: string; name: string }[];
  products: EditorProduct[];
  taxRates: { name: string; rateBasisPoints: number }[];
  initial: EditorDocument;
  /** Absent on creation. */
  documentId?: string;
}) {
  const [state, action, pending] = useActionState(
    kind === 'quote' ? saveQuote : saveInvoice,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [lines, setLines] = useState<LineState[]>(() =>
    initial.lines.map((line) => ({
      key: crypto.randomUUID(),
      productId: line.productId,
      label: line.label,
      unit: line.unit,
      quantity: String(line.quantity).replace('.', ','),
      // A new empty line starts blank rather than at « 0 ».
      unitPrice:
        line.label === '' && line.unitPrice === 0
          ? ''
          : amountInputValue(line.unitPrice, currency),
      taxRateBasisPoints: line.taxRateBasisPoints,
    })),
  );
  const [discount, setDiscount] = useState(
    initial.discount ? amountInputValue(initial.discount, currency) : '',
  );
  const [notes, setNotes] = useState(initial.notes);
  const [date, setDate] = useState(initial.date);
  const errors = state.fieldErrors ?? {};
  const money = (value: number) => formatAmount(value, currency);

  const update = (key: string, change: Partial<LineState>) =>
    setLines((all) =>
      all.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  const pickProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    update(
      key,
      product
        ? {
            productId: product.id,
            label: product.name,
            unit: product.unit,
            unitPrice: amountInputValue(product.salePrice, currency),
            taxRateBasisPoints: product.taxRateBasisPoints,
          }
        : { productId: null },
    );
  };
  const addLine = () =>
    setLines((all) => [
      ...all,
      {
        key: crypto.randomUUID(),
        productId: null,
        label: '',
        unit: 'piece',
        quantity: '1',
        unitPrice: '',
        taxRateBasisPoints: null,
      },
    ]);

  const numeric = lines.map((line) => {
    const quantity = Number(line.quantity.replace(/\s/g, '').replace(',', '.'));
    const unitPrice = parseAmount(line.unitPrice, currency);
    return {
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
      unitPrice: unitPrice ?? 0,
      taxRateBasisPoints: line.taxRateBasisPoints,
    };
  });
  const discountValue =
    discount.trim() === '' ? 0 : (parseAmount(discount, currency) ?? 0);
  const totals = computeDocumentTotals(numeric, discountValue);
  const rateOptions = [
    ...new Set([
      ...taxRates.map((t) => t.rateBasisPoints),
      ...lines.flatMap((l) =>
        l.taxRateBasisPoints === null ? [] : [l.taxRateBasisPoints],
      ),
    ]),
  ].sort((a, b) => a - b);

  const payload = JSON.stringify({
    customerId,
    lines: lines.map((line) => ({
      productId: line.productId,
      label: line.label,
      unit: line.unit,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRateBasisPoints: line.taxRateBasisPoints,
    })),
    discount,
    notes,
    date,
  });

  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      {documentId ? (
        <input type="hidden" name="documentId" value={documentId} />
      ) : (
        <input type="hidden" name="clientOperationId" value={operationId} />
      )}
      <input type="hidden" name="document" value={payload} />
      <FormMessage state={state} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="doc-customer" className={LABEL}>
          Client
        </label>
        <select
          id="doc-customer"
          value={customerId}
          onChange={(event) => setCustomerId(event.currentTarget.value)}
          aria-invalid={errors.customerId ? true : undefined}
          aria-describedby={
            errors.customerId ? 'doc-customer-error' : undefined
          }
          className={CONTROL}
        >
          <option value="">Choisir le client</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <FieldError id="doc-customer-error" error={errors.customerId} />
        <p className="text-ink-muted">
          Client absent de la liste ?{' '}
          <Link
            href="/espace/clients"
            className="font-semibold text-brand-ink underline"
          >
            Ajoutez-le dans Clients
          </Link>
          , avec son adresse.
        </p>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Articles et services</legend>
        {errors.lines && <p className={ERROR}>{errors.lines}</p>}
        <ol className="flex flex-col gap-4">
          {lines.map((line, index) => {
            const at = (field: string) => errors[`lines.${index}.${field}`];
            const fieldId = (field: string) => `line-${line.key}-${field}`;
            const describedBy = (field: string) =>
              at(field) ? `${fieldId(field)}-error` : undefined;
            return (
              <li
                key={line.key}
                aria-label={`Ligne ${index + 1}`}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-muted p-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={fieldId('product')} className={LABEL}>
                    Produit du catalogue
                  </label>
                  <select
                    id={fieldId('product')}
                    value={line.productId ?? ''}
                    onChange={(event) =>
                      pickProduct(line.key, event.currentTarget.value)
                    }
                    className={CONTROL}
                  >
                    <option value="">Aucun : ligne libre (service…)</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={fieldId('label')} className={LABEL}>
                    Désignation
                  </label>
                  <input
                    id={fieldId('label')}
                    value={line.label}
                    maxLength={160}
                    onChange={(event) =>
                      update(line.key, { label: event.currentTarget.value })
                    }
                    aria-invalid={at('label') ? true : undefined}
                    aria-describedby={describedBy('label')}
                    className={CONTROL}
                  />
                  <FieldError
                    id={`${fieldId('label')}-error`}
                    error={at('label')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={fieldId('quantity')} className={LABEL}>
                      Quantité
                    </label>
                    <input
                      id={fieldId('quantity')}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) =>
                        update(line.key, {
                          quantity: event.currentTarget.value,
                        })
                      }
                      aria-invalid={at('quantity') ? true : undefined}
                      aria-describedby={describedBy('quantity')}
                      className={CONTROL}
                    />
                    <FieldError
                      id={`${fieldId('quantity')}-error`}
                      error={at('quantity')}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={fieldId('unit')} className={LABEL}>
                      Unité
                    </label>
                    <select
                      id={fieldId('unit')}
                      value={line.unit}
                      onChange={(event) =>
                        update(line.key, {
                          unit: event.currentTarget.value as Unit,
                        })
                      }
                      className={CONTROL}
                    >
                      {UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={fieldId('price')} className={LABEL}>
                      Prix unitaire TTC
                    </label>
                    <input
                      id={fieldId('price')}
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(event) =>
                        update(line.key, {
                          unitPrice: event.currentTarget.value,
                        })
                      }
                      aria-invalid={at('unitPrice') ? true : undefined}
                      aria-describedby={
                        at('unitPrice')
                          ? `${fieldId('price')}-error`
                          : undefined
                      }
                      className={CONTROL}
                    />
                    <FieldError
                      id={`${fieldId('price')}-error`}
                      error={at('unitPrice')}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={fieldId('tax')} className={LABEL}>
                      TVA
                    </label>
                    <select
                      id={fieldId('tax')}
                      value={line.taxRateBasisPoints ?? ''}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        update(line.key, {
                          taxRateBasisPoints:
                            value === '' ? null : Number(value),
                        });
                      }}
                      className={CONTROL}
                    >
                      <option value="">Sans taxe</option>
                      {rateOptions.map((rate) => (
                        <option key={rate} value={rate}>
                          {formatRate(rate)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-bold tabular-nums">
                    {money(totals.lineTotals[index] ?? 0)}
                  </p>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((all) => all.filter((l) => l.key !== line.key))
                      }
                      className={buttonClasses('secondary')}
                    >
                      <Trash2 aria-hidden className="size-5" />
                      Retirer la ligne {index + 1}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div>
          <button
            type="button"
            onClick={addLine}
            disabled={lines.length >= 200}
            className={buttonClasses('secondary')}
          >
            <Plus aria-hidden className="size-5" />
            Ajouter une ligne
          </button>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-discount" className={LABEL}>
            Remise (facultatif)
          </label>
          <input
            id="doc-discount"
            inputMode="decimal"
            value={discount}
            onChange={(event) => setDiscount(event.currentTarget.value)}
            aria-invalid={errors.discount ? true : undefined}
            aria-describedby={
              errors.discount ? 'doc-discount-error' : undefined
            }
            className={CONTROL}
          />
          <FieldError id="doc-discount-error" error={errors.discount} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-date" className={LABEL}>
            {kind === 'quote'
              ? 'Valable jusqu’au'
              : 'À payer avant le (facultatif)'}
          </label>
          <input
            id="doc-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.currentTarget.value)}
            aria-invalid={
              errors.validUntil || errors.dueDate ? true : undefined
            }
            aria-describedby={
              errors.validUntil || errors.dueDate ? 'doc-date-error' : undefined
            }
            className={CONTROL}
          />
          <FieldError
            id="doc-date-error"
            error={errors.validUntil ?? errors.dueDate}
          />
          {kind === 'invoice' && (
            <p className="text-ink-muted">
              Vide : le délai de paiement de vos paramètres, compté à partir du
              jour où la facture est émise.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="doc-notes" className={LABEL}>
          Remarque imprimée sur le document (facultatif)
        </label>
        <textarea
          id="doc-notes"
          value={notes}
          maxLength={2000}
          rows={3}
          onChange={(event) => setNotes(event.currentTarget.value)}
          className={`${CONTROL} py-3`}
        />
      </div>

      <dl
        aria-label="Totaux"
        className="flex flex-col gap-1 rounded-2xl bg-invoices-soft p-4 text-invoices-ink"
      >
        {totals.discount > 0 && (
          <div className="flex justify-between gap-3">
            <dt>Remise</dt>
            <dd className="tabular-nums">−{money(totals.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt>Total hors taxes</dt>
          <dd className="tabular-nums">{money(totals.totalExcludingTax)}</dd>
        </div>
        {totals.taxByRate.map((tax) => (
          <div key={tax.rateBasisPoints} className="flex justify-between gap-3">
            <dt>TVA {formatRate(tax.rateBasisPoints)}</dt>
            <dd className="tabular-nums">{money(tax.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 text-2xl font-extrabold">
          <dt>Total TTC</dt>
          <dd className="tabular-nums">{money(totals.total)}</dd>
        </div>
      </dl>

      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {documentId
            ? 'Enregistrer les changements'
            : kind === 'quote'
              ? 'Créer le devis'
              : 'Enregistrer le brouillon'}
        </SubmitButton>
      </div>
      <p className="text-ink-muted">
        {kind === 'quote'
          ? 'Le devis reçoit son numéro dès sa création.'
          : 'La facture reçoit son numéro quand vous l’émettez ; jusque-là vous pouvez la modifier.'}
      </p>
    </ActionForm>
  );
}
