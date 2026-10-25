'use client';

import { amountInputValue, formatAmount, parseAmount } from '@nagaw/shared';
import { useActionState, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { PhotoField } from '@/components/catalog/photo-field';
import { FormField, SelectField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState, type FormState } from '@/lib/auth/schemas';
import {
  attachReceipt,
  cancelExpense,
  createClosing,
  createExpense,
  createExpenseCategory,
  createTransfer,
  setExpenseCategoryStatus,
  updateAccount,
} from './actions';

type Option = { value: string; label: string };

/** A new operation id after each success, so that the form starts over. */
function useOperation(state: FormState) {
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [handled, setHandled] = useState<FormState>(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === 'success') setOperationId(crypto.randomUUID());
  }
  return operationId;
}

export function ExpenseForm({
  organizationId,
  categories,
  accounts,
  today,
}: {
  organizationId: string;
  categories: Option[];
  accounts: Option[];
  today: string;
}) {
  const [state, action, pending] = useActionState(
    createExpense,
    initialFormState,
  );
  const operationId = useOperation(state);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      <ActionForm
        key={operationId}
        action={action}
        pending={pending}
        noValidate
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="clientOperationId" value={operationId} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Ce qui a été payé"
            name="label"
            id="expense-label"
            maxLength={120}
            required
            placeholder="Loyer d’octobre, facture Senelec…"
            error={errors.label}
          />
          <FormField
            label="Montant"
            name="amount"
            id="expense-amount"
            inputMode="decimal"
            required
            error={errors.amount}
          />
          <SelectField
            label="Catégorie"
            name="categoryId"
            id="expense-category"
            defaultValue=""
            options={[{ value: '', label: 'Choisir' }, ...categories]}
            error={errors.categoryId}
          />
          <SelectField
            label="Payé depuis"
            name="cashAccountId"
            id="expense-account"
            defaultValue={accounts[0]?.value ?? ''}
            options={accounts}
            error={errors.cashAccountId}
          />
          <FormField
            label="Date"
            name="occurredOn"
            id="expense-date"
            type="date"
            defaultValue={today}
            max={today}
            required
            error={errors.occurredOn}
          />
        </div>
        <div>
          <SubmitButton pendingLabel="Enregistrement…">
            Enregistrer la dépense
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export function CancelExpenseForm({
  organizationId,
  expenseId,
  label,
}: {
  organizationId: string;
  expenseId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    cancelExpense,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <FormMessage state={state} />
      <FormField
        label={`Pourquoi annuler « ${label} » ?`}
        name="reason"
        id={`cancel-${expenseId}`}
        maxLength={500}
        required
        error={state.fieldErrors?.reason}
      />
      <div>
        <SubmitButton variant="danger" pendingLabel="Annulation…">
          Annuler la dépense
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TransferForm({
  organizationId,
  accounts,
  today,
}: {
  organizationId: string;
  accounts: Option[];
  today: string;
}) {
  const [state, action, pending] = useActionState(
    createTransfer,
    initialFormState,
  );
  const operationId = useOperation(state);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      <ActionForm
        key={operationId}
        action={action}
        pending={pending}
        noValidate
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="clientOperationId" value={operationId} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Sortir de"
            name="fromAccountId"
            id="transfer-from"
            defaultValue={accounts[0]?.value ?? ''}
            options={accounts}
            error={errors.fromAccountId}
          />
          <SelectField
            label="Mettre dans"
            name="toAccountId"
            id="transfer-to"
            defaultValue={accounts.at(-1)?.value ?? ''}
            options={accounts}
            error={errors.toAccountId}
          />
          <FormField
            label="Montant"
            name="amount"
            id="transfer-amount"
            inputMode="decimal"
            required
            error={errors.amount}
          />
          <FormField
            label="Date"
            name="occurredOn"
            id="transfer-date"
            type="date"
            defaultValue={today}
            max={today}
            required
            error={errors.occurredOn}
          />
          <FormField
            label="Remarque (facultatif)"
            name="note"
            id="transfer-note"
            maxLength={200}
            placeholder="Dépôt à la banque, retrait Wave…"
            error={errors.note}
          />
        </div>
        <div>
          <SubmitButton pendingLabel="Enregistrement…">
            Déplacer l’argent
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

/** The person counts; the difference with what was expected shows live. */
export function ClosingForm({
  organizationId,
  accountId,
  day,
  expected,
  currency,
}: {
  organizationId: string;
  accountId: string;
  day: string;
  expected: number;
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    createClosing,
    initialFormState,
  );
  const [operationId] = useState(() => crypto.randomUUID());
  const [counted, setCounted] = useState('');
  const value = parseAmount(counted, currency);
  const difference = value === null ? null : value - expected;
  const money = (amount: number) => formatAmount(amount, currency);
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="cashAccountId" value={accountId} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="clientOperationId" value={operationId} />
      <FormMessage state={state} />
      <FormField
        label="Ce que vous avez compté"
        name="countedAmount"
        id="closing-counted"
        inputMode="decimal"
        required
        value={counted}
        onChange={(event) => setCounted(event.currentTarget.value)}
        error={state.fieldErrors?.countedAmount}
      />
      <p aria-live="polite" className="text-lg font-bold">
        {difference === null
          ? `Attendu : ${money(expected)}`
          : difference === 0
            ? 'Le compte est juste.'
            : difference < 0
              ? `Il manque ${money(-difference)}.`
              : `Il y a ${money(difference)} de trop.`}
      </p>
      <FormField
        label="Remarque (facultatif)"
        name="note"
        id="closing-note"
        maxLength={500}
        placeholder="Billet abîmé, monnaie rendue en trop…"
        error={state.fieldErrors?.note}
      />
      <div>
        <SubmitButton pendingLabel="Clôture…">Clôturer la journée</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AccountForm({
  organizationId,
  account,
  currency,
  counted,
}: {
  organizationId: string;
  account: { id: string; name: string; openingBalance: number };
  currency: string;
  /** Once counted, the opening balance no longer changes. */
  counted: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAccount,
    initialFormState,
  );
  const errors = state.fieldErrors ?? {};
  const opening = account.openingBalance;
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="accountId" value={account.id} />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Nom"
          name="name"
          id="account-name"
          defaultValue={account.name}
          maxLength={60}
          required
          error={errors.name}
        />
        {!counted && (
          <FormField
            label="Argent déjà là au départ"
            name="openingBalance"
            id="account-opening"
            inputMode="decimal"
            defaultValue={
              opening < 0
                ? `-${amountInputValue(-opening, currency)}`
                : amountInputValue(opening, currency)
            }
            error={errors.openingBalance}
          />
        )}
      </div>
      <div>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CategoryForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(
    createExpenseCategory,
    initialFormState,
  );
  const operationId = useOperation(state);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      <ActionForm
        key={operationId}
        action={action}
        pending={pending}
        noValidate
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Nom"
            name="name"
            id="category-name"
            maxLength={60}
            required
            error={errors.name}
          />
          <FormField
            label="Compte SYSCOHADA"
            name="accountCode"
            id="category-account"
            inputMode="numeric"
            maxLength={8}
            required
            placeholder="627"
            error={errors.accountCode}
          />
        </div>
        <div>
          <SubmitButton pendingLabel="Ajout…">
            Ajouter la catégorie
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export function CategoryStatusButton({
  organizationId,
  categoryId,
  name,
  archived,
}: {
  organizationId: string;
  categoryId: string;
  name: string;
  archived: boolean;
}) {
  const [state, action, pending] = useActionState(
    setExpenseCategoryStatus,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      className="flex flex-col items-end gap-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input
        type="hidden"
        name="status"
        value={archived ? 'active' : 'archived'}
      />
      <FormMessage state={state} />
      <SubmitButton
        variant="secondary"
        pendingLabel="…"
        aria-label={archived ? `Reprendre ${name}` : `Ranger ${name}`}
      >
        {archived ? 'Reprendre' : 'Ranger'}
      </SubmitButton>
    </ActionForm>
  );
}

export function ReceiptForm({
  organizationId,
  expenseId,
  currentUrl,
}: {
  organizationId: string;
  expenseId: string;
  currentUrl: string | null;
}) {
  const [state, action, pending] = useActionState(
    attachReceipt,
    initialFormState,
  );
  return (
    <ActionForm
      action={action}
      pending={pending}
      encType="multipart/form-data"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <FormMessage state={state} />
      <PhotoField
        legend="Photo du justificatif (reçu, facture du fournisseur)"
        currentUrl={currentUrl}
        removable={false}
        error={state.fieldErrors?.photo}
      />
      <div>
        <SubmitButton pendingLabel="Envoi…">
          Enregistrer le justificatif
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
