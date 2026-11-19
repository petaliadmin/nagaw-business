'use client';

import { amountInputValue, formatAmount, parseAmount } from '@nagaw/shared';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  createElement,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ActionForm } from '@/components/action-form';
import { PhotoField } from '@/components/catalog/photo-field';
import { FormField } from '@/components/form-field';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { FormSteps } from '@/components/ui/form-steps';
import { Keypad } from '@/components/ui/keypad';
import {
  AccountIcon,
  type AccountLook,
} from '@/components/treasury/account-icon';
import { categoryIcon } from '@/lib/treasury/category-icons';
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

type Option = {
  value: string;
  label: string;
  /** An account: its picture is shown beside its name. */
  account?: AccountLook;
  /** An expense category: its SYSCOHADA account picks its picture. */
  accountCode?: string;
};

/** The picture of a choice, for people who do not read easily. */
function OptionIcon({ option }: { option: Option }) {
  if (option.account)
    return <AccountIcon account={option.account} size="size-8" />;
  if (option.accountCode !== undefined) {
    return (
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas"
      >
        {createElement(categoryIcon(option.accountCode), {
          className: 'size-5',
        })}
      </span>
    );
  }
  return null;
}

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
            <span
              className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-transparent bg-surface pr-4 font-bold peer-checked:border-ink peer-checked:bg-canvas peer-focus-visible:outline-3 peer-focus-visible:outline-focus ${
                option.account || option.accountCode !== undefined
                  ? 'pl-1.5'
                  : 'pl-4'
              }`}
            >
              <OptionIcon option={option} />
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="font-semibold text-danger-ink">{error}</p>}
    </fieldset>
  );
}

type ExpenseStep = 1 | 2 | 3;

/** The step that holds a field, to show it again when it is refused. */
function stepOf(errors: Record<string, string>, steps: number): ExpenseStep {
  if (errors.amount) return 1;
  if (errors.categoryId && steps === 3) return 2;
  return steps as ExpenseStep;
}

/**
 * A new expense in three steps, like a mobile money transfer (ADR-063):
 * how much on a keypad, what for, paid with what — then one button. One
 * form underneath: the hidden steps keep their values and are sent with
 * it, and the server checks everything again.
 */
export function ExpenseForm({
  organizationId,
  categories,
  accounts,
  today,
  currency,
  onSaved,
}: {
  organizationId: string;
  categories: Option[];
  accounts: Option[];
  today: string;
  currency: string;
  /** Where to go once it is saved. */
  onSaved?: string;
}) {
  const [state, action, pending] = useActionState(
    createExpense,
    initialFormState,
  );
  const operationId = useOperation(state);
  // Without categories to choose from, the second step is left out.
  const steps = categories.length > 0 ? 3 : 2;
  const [step, setStep] = useState<ExpenseStep>(1);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Option | null>(null);
  const [problem, setProblem] = useState('');
  const [seen, setSeen] = useState<FormState>(state);
  const title = useRef<HTMLHeadingElement>(null);
  const errors = state.fieldErrors ?? {};
  if (state !== seen) {
    setSeen(state);
    if (state.status === 'success') {
      setAmount('');
      setCategory(null);
      setStep(1);
      if (onSaved) window.location.assign(onSaved);
    } else if (state.fieldErrors) {
      setStep(stepOf(state.fieldErrors, steps));
    }
  }
  // Focus follows the step, so that a screen reader says where it is.
  const focused = useRef(step);
  useEffect(() => {
    if (focused.current === step) return;
    focused.current = step;
    title.current?.focus();
  }, [step]);

  const shown = steps === 3 ? step : step === 1 ? 1 : 2;
  const last: ExpenseStep = steps === 3 ? 3 : 2;
  const labels: Record<ExpenseStep, string> =
    steps === 3
      ? { 1: 'Combien ?', 2: 'Pour quoi ?', 3: 'Payé avec quoi ?' }
      : { 1: 'Combien ?', 2: 'Payé avec quoi ?', 3: 'Payé avec quoi ?' };
  const value = parseAmount(amount, currency) ?? 0;

  function next() {
    if (step === 1 && value <= 0) {
      setProblem('Tapez le montant payé.');
      return;
    }
    if (step === 2 && steps === 3 && !category) {
      setProblem('Choisissez pour quoi vous avez payé.');
      return;
    }
    setProblem('');
    setStep((current) => (current + 1) as ExpenseStep);
  }
  function back() {
    setProblem('');
    setStep((current) => (current - 1) as ExpenseStep);
  }
  const press = (key: string) => {
    setProblem('');
    setAmount((current) =>
      key === 'del' ? current.slice(0, -1) : (current + key).replace(/^0+/, ''),
    );
  };
  const isCategories = steps === 3 && step === 2;
  const isAccounts = step === last;

  return (
    <div className="flex flex-col gap-4">
      <FormSteps step={shown} total={steps} label={labels[step]} />
      <FormMessage state={state} />
      <ActionForm
        key={operationId}
        action={action}
        pending={pending}
        noValidate
        className="flex flex-col gap-5"
        onKeyDown={(event) => {
          // « Entrée » goes to the next step, it does not send too early.
          if (
            event.key === 'Enter' &&
            !isAccounts &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            next();
          }
        }}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="clientOperationId" value={operationId} />
        <input
          type="hidden"
          name="labelFallback"
          value={category?.label ?? ''}
        />
        <h2 ref={title} tabIndex={-1} className="sr-only">
          {labels[step]}
        </h2>

        {/* Step 1: how much. */}
        <div hidden={step !== 1} className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-1">
            <label
              htmlFor="expense-amount"
              className="font-bold text-ink-muted"
            >
              Montant
            </label>
            <input
              id="expense-amount"
              name="amount"
              inputMode="numeric"
              required
              // Grouped by thousands as people write it; the server reads
              // the digits.
              value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              onChange={(event) => {
                setProblem('');
                setAmount(event.target.value.replace(/[^\d]/g, ''));
              }}
              placeholder="0"
              aria-invalid={errors.amount ? true : undefined}
              className="w-full bg-transparent text-center text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-ink-muted"
            />
            {errors.amount && (
              <p className="font-semibold text-danger-ink">{errors.amount}</p>
            )}
          </div>
          <Keypad onPress={press} />
        </div>

        {/* Step 2: what for. */}
        {steps === 3 && (
          <div hidden={!isCategories}>
            <ChoicePills
              legend="Pour quoi"
              name="categoryId"
              options={categories}
              error={errors.categoryId}
              onPick={(option) => {
                setProblem('');
                setCategory(option);
              }}
            />
          </div>
        )}

        {/* Last step: paid with what, then save. */}
        <div hidden={!isAccounts} className="flex flex-col gap-5">
          <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-3xl bg-surface px-4 py-3">
            <span className="font-bold text-ink-muted">
              {category ? category.label : 'Dépense'}
            </span>
            <span className="text-2xl font-extrabold tabular-nums">
              {formatAmount(value, currency)}
            </span>
          </p>
          <ChoicePills
            legend="Payé avec"
            name="cashAccountId"
            options={accounts}
            defaultValue={accounts[0]?.value}
            error={errors.cashAccountId}
          />
          <details
            className="rounded-3xl bg-surface px-4 py-1"
            open={Boolean(errors.label || errors.occurredOn)}
          >
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
        </div>

        <p role="status" className="min-h-6 font-semibold text-danger-ink">
          {problem}
        </p>
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              aria-label="Retour"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface"
            >
              <ArrowLeft aria-hidden className="size-6" />
            </button>
          )}
          {isAccounts ? (
            <SubmitButton
              pendingLabel="Enregistrement…"
              className="min-h-14 flex-1 text-lg"
            >
              Enregistrer la dépense
            </SubmitButton>
          ) : (
            <button
              type="button"
              onClick={next}
              className={buttonClasses('primary', 'min-h-14 flex-1 text-lg')}
            >
              Continuer
              <ArrowRight aria-hidden className="size-5" />
            </button>
          )}
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
          {/* Pictures with the names: Wave, Orange Money… are recognised
              at a glance (ADR-063). */}
          <div className="md:col-span-2">
            <ChoicePills
              legend="Sortir de"
              name="fromAccountId"
              options={accounts}
              defaultValue={accounts[0]?.value}
              error={errors.fromAccountId}
            />
          </div>
          <div className="md:col-span-2">
            <ChoicePills
              legend="Mettre dans"
              name="toAccountId"
              options={accounts}
              defaultValue={accounts.at(-1)?.value}
              error={errors.toAccountId}
            />
          </div>
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
  look: AccountLook;
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
                <span className="flex items-center gap-2 text-lg font-extrabold">
                  <AccountIcon account={row.look} />
                  {row.name}
                </span>
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
