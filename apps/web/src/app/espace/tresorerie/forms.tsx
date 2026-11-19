'use client';

import { amountInputValue, formatAmount, parseAmount } from '@nagaw/shared';
import { Delete } from 'lucide-react';
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
  createClosings,
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

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Radio pills: one choice among a few, touched rather than picked. */
function ChoicePills({
  legend,
  name,
  options,
  defaultValue,
  error,
  onPick,
}: {
  legend: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  error?: string;
  onPick?: (option: Option) => void;
}) {
  return (
    <fieldset
      className="flex flex-col gap-2"
      onChange={(event) => {
        const picked = options.find(
          (o) =>
            event.target instanceof HTMLInputElement &&
            o.value === event.target.value,
        );
        if (picked) onPick?.(picked);
      }}
    >
      <legend className="mb-2 font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-12 items-center rounded-full border-2 border-transparent bg-surface px-4 font-bold peer-checked:border-ink peer-checked:bg-canvas peer-focus-visible:outline-3 peer-focus-visible:outline-focus">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="font-semibold text-danger-ink">{error}</p>}
    </fieldset>
  );
}

/**
 * A new expense like a mobile money transfer (ADR-063): the amount in
 * large typed on a keypad, what it was for and where the money came from
 * as pills, then one button. The date and a detail are folded away.
 */
export function ExpenseForm({
  organizationId,
  categories,
  accounts,
  today,
  onSaved,
}: {
  organizationId: string;
  categories: Option[];
  accounts: Option[];
  today: string;
  /** Where to go once it is saved. */
  onSaved?: string;
}) {
  const [state, action, pending] = useActionState(
    createExpense,
    initialFormState,
  );
  const operationId = useOperation(state);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [seen, setSeen] = useState<FormState>(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === 'success') {
      setAmount('');
      if (onSaved) window.location.assign(onSaved);
    }
  }
  const errors = state.fieldErrors ?? {};
  const press = (key: string) =>
    setAmount((value) =>
      key === 'del' ? value.slice(0, -1) : (value + key).replace(/^0+/, ''),
    );
  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />
      <ActionForm
        key={operationId}
        action={action}
        pending={pending}
        noValidate
        className="flex flex-col gap-5"
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="clientOperationId" value={operationId} />
        <input type="hidden" name="labelFallback" value={category} />
        <div className="flex flex-col items-center gap-1">
          <label htmlFor="expense-amount" className="font-bold text-ink-muted">
            Montant
          </label>
          <input
            id="expense-amount"
            name="amount"
            inputMode="numeric"
            required
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value.replace(/[^\d]/g, ''))
            }
            placeholder="0"
            aria-invalid={errors.amount ? true : undefined}
            className="w-full bg-transparent text-center text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-ink-muted"
          />
          {errors.amount && (
            <p className="font-semibold text-danger-ink">{errors.amount}</p>
          )}
        </div>
        {categories.length > 0 && (
          <ChoicePills
            legend="Pour quoi"
            name="categoryId"
            options={categories}
            error={errors.categoryId}
            onPick={(option) => setCategory(option.label)}
          />
        )}
        <ChoicePills
          legend="Payé avec"
          name="cashAccountId"
          options={accounts}
          defaultValue={accounts[0]?.value}
          error={errors.cashAccountId}
        />
        <div
          role="group"
          aria-label="Pavé numérique"
          className="grid grid-cols-3 gap-2"
        >
          {KEYS.map((key, index) =>
            key === '' ? (
              <span key={index} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === 'del' ? 'Effacer un chiffre' : undefined}
                className="flex min-h-14 items-center justify-center rounded-2xl bg-surface text-2xl font-extrabold"
              >
                {key === 'del' ? (
                  <Delete aria-hidden className="size-7" />
                ) : (
                  key
                )}
              </button>
            ),
          )}
        </div>
        <details className="rounded-3xl bg-surface px-4 py-1">
          <summary className="flex min-h-12 cursor-pointer items-center font-bold">
            Détail et date
          </summary>
          <div className="flex flex-col gap-4 pb-4">
            <FormField
              label="Ce qui a été payé (facultatif)"
              name="label"
              id="expense-label"
              maxLength={120}
              placeholder="Loyer d’octobre, facture Senelec…"
              error={errors.label}
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
        </details>
        <SubmitButton pendingLabel="Enregistrement…">
          Enregistrer la dépense
        </SubmitButton>
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

export interface ClosingRow {
  id: string;
  name: string;
  expected: number;
  /** Already closed this day: what was counted and the difference. */
  closed: { counted: number; difference: number; by: string } | null;
}

/**
 * Every account of the shop on one screen (ADR-063): what was expected,
 * what the person counts, the difference in plain words as they type, one
 * note and one button for all. An account left empty is not closed.
 */
export function ClosingsForm({
  organizationId,
  day,
  rows,
  currency,
}: {
  organizationId: string;
  day: string;
  rows: ClosingRow[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    createClosings,
    initialFormState,
  );
  const [operations] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.id, crypto.randomUUID()])),
  );
  const [counted, setCounted] = useState<Record<string, string>>({});
  const money = (amount: number) => formatAmount(amount, currency);
  const open = rows.filter((r) => !r.closed);
  const gap = (difference: number) =>
    difference === 0
      ? 'Le compte est juste.'
      : difference < 0
        ? `Il manque ${money(-difference)}.`
        : `Il y a ${money(difference)} de trop.`;
  return (
    <ActionForm
      action={action}
      pending={pending}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="day" value={day} />
      <FormMessage state={state} />
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const value = parseAmount(counted[row.id] ?? '', currency);
          const difference = value === null ? null : value - row.expected;
          const error = state.fieldErrors?.[`counted-${row.id}`];
          return (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-3xl bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-lg font-extrabold">{row.name}</span>
                <span className="text-ink-muted">
                  Attendu {money(row.expected)}
                </span>
              </div>
              {row.closed ? (
                <p
                  className={`rounded-2xl px-4 py-3 font-bold ${
                    row.closed.difference === 0
                      ? 'bg-sales-soft text-sales-ink'
                      : 'bg-warning-soft text-warning-ink'
                  }`}
                >
                  Journée clôturée par {row.closed.by} :{' '}
                  {money(row.closed.counted)} comptés
                  {row.closed.difference === 0
                    ? ', le compte était juste.'
                    : row.closed.difference < 0
                      ? `, il manquait ${money(-row.closed.difference)}.`
                      : `, il y avait ${money(row.closed.difference)} de trop.`}
                </p>
              ) : (
                <>
                  <input type="hidden" name="accountId" value={row.id} />
                  <input
                    type="hidden"
                    name={`operation-${row.id}`}
                    value={operations[row.id]}
                  />
                  <FormField
                    label={`${row.name} : ce que vous avez compté`}
                    name={`counted-${row.id}`}
                    id={`counted-${row.id}`}
                    inputMode="decimal"
                    value={counted[row.id] ?? ''}
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      setCounted((all) => ({ ...all, [row.id]: next }));
                    }}
                    error={error}
                  />
                  {difference !== null && (
                    <p
                      aria-live="polite"
                      className={`rounded-2xl px-4 py-3 font-extrabold ${
                        difference === 0
                          ? 'bg-sales-soft text-sales-ink'
                          : 'bg-warning-soft text-warning-ink'
                      }`}
                    >
                      {gap(difference)}
                    </p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {open.length > 0 && (
        <>
          <p className="text-ink-muted">
            Envoyez d’abord les ventes faites sans connexion : elles comptent
            dans ce qui est attendu. Une fois clôturée, la journée ne change
            plus.
          </p>
          <FormField
            label="Pourquoi cet écart ? (facultatif)"
            name="note"
            id="closing-note"
            maxLength={500}
            placeholder="Ex. monnaie rendue en trop"
            error={state.fieldErrors?.note}
          />
          <SubmitButton pendingLabel="Clôture…">
            Clôturer la journée
          </SubmitButton>
        </>
      )}
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
