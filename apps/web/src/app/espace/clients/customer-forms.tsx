'use client';

import {
  amountInputValue,
  MOBILE_MONEY_PROVIDERS,
  type CustomerDto,
} from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';
import {
  createCustomer,
  recordRepayment,
  updateCustomer,
} from '../vendre/actions';
import { currencySymbol } from '../produits/product-form';

export function CustomerForm({
  organizationId,
  currency,
  customer,
}: {
  organizationId: string;
  currency: string;
  /** Absent on creation. */
  customer?: CustomerDto;
}) {
  const [state, action, pending] = useActionState(
    customer ? updateCustomer : createCustomer,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  const errors = state.fieldErrors ?? {};
  const prefix = customer ? 'edit-' : 'new-';
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      {customer ? (
        <input type="hidden" name="customerId" value={customer.id} />
      ) : (
        <input type="hidden" name="clientOperationId" value={operationId} />
      )}
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Nom"
          name="name"
          id={`${prefix}name`}
          defaultValue={customer?.name}
          required
          maxLength={120}
          autoComplete="off"
          error={errors.name}
        />
        <FormField
          label="Téléphone (facultatif)"
          name="phone"
          id={`${prefix}phone`}
          type="tel"
          inputMode="tel"
          defaultValue={customer?.phone}
          maxLength={30}
          error={errors.phone}
        />
        <FormField
          label="E-mail (facultatif)"
          name="email"
          id={`${prefix}email`}
          type="email"
          inputMode="email"
          defaultValue={customer?.email}
          maxLength={320}
          error={errors.email}
        />
        <FormField
          label="Adresse, pour les factures (facultatif)"
          name="address"
          id={`${prefix}address`}
          defaultValue={customer?.address}
          maxLength={300}
          error={errors.address}
        />
        <FormField
          label="NINEA, pour les entreprises (facultatif)"
          name="taxId"
          id={`${prefix}taxId`}
          defaultValue={customer?.taxId}
          maxLength={40}
          error={errors.taxId}
        />
        <FormField
          label={`Crédit maximum (${currencySymbol(currency)}, facultatif)`}
          name="creditLimit"
          id={`${prefix}creditLimit`}
          inputMode="decimal"
          defaultValue={
            customer?.creditLimit != null
              ? amountInputValue(customer.creditLimit, currency)
              : undefined
          }
          error={errors.creditLimit}
        />
        <FormField
          label="Remarque (facultatif)"
          name="notes"
          id={`${prefix}notes`}
          defaultValue={customer?.notes}
          maxLength={1000}
          error={errors.notes}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          {customer ? 'Enregistrer' : 'Ajouter le client'}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** The customer pays back part or all of what they owe. */
export function RepaymentForm({
  organizationId,
  currency,
  customer,
}: {
  organizationId: string;
  currency: string;
  customer: CustomerDto;
}) {
  const [state, action, pending] = useActionState(
    recordRepayment,
    initialFormState,
  );
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [method, setMethod] = useState('cash');
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') setOperationId(crypto.randomUUID());
  }
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      key={operationId}
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="customerId" value={customer.id} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label={`Montant reçu (${currencySymbol(currency)})`}
          name="amount"
          id="repay-amount"
          inputMode="decimal"
          defaultValue={amountInputValue(customer.balance, currency)}
          required
          error={errors.amount}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="repay-method" className="text-base font-semibold">
            Payé en
          </label>
          <select
            id="repay-method"
            name="method"
            value={method}
            onChange={(event) => setMethod(event.currentTarget.value)}
            className="min-h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-2 text-base text-ink"
          >
            {(['cash', 'mobile_money', 'card'] as const).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        {method === 'mobile_money' && (
          <>
            <SelectField
              label="Opérateur"
              name="provider"
              id="repay-provider"
              defaultValue="wave"
              options={MOBILE_MONEY_PROVIDERS.map((p) => ({
                value: p,
                label: PROVIDER_LABELS[p],
              }))}
              error={errors.provider}
            />
            <FormField
              label="Numéro de transaction (facultatif)"
              name="reference"
              id="repay-reference"
              maxLength={60}
              error={errors.reference}
            />
          </>
        )}
      </div>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer le remboursement
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
