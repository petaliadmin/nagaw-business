import {
  formatAmount,
  roleHasPermission,
  type ExpenseCategoryDto,
  type ExpenseDto,
} from '@nagaw/shared';
import { Plus, Tags } from 'lucide-react';
import type { Metadata } from 'next';
import { createElement, Suspense } from 'react';
import { categoryIcon } from '@/lib/treasury/category-icons';
import { PeriodPicker } from '@/components/treasury/period-picker';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { FoldCard } from '@/components/ui/fold-card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, todayIn } from '@/lib/format';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { resolvePeriod } from '@/lib/treasury/period';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  CancelExpenseForm,
  ReceiptForm,
  CategoryForm,
  CategoryStatusButton,
} from '../forms';

export const metadata: Metadata = { title: 'Dépenses — Nagaw Business' };

async function Expenses({
  searchParams,
}: PageProps<'/espace/tresorerie/depenses'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'treasury.read'))
    return (
      <>
        <PageHeader title="Dépenses" />
        <Alert>Votre rôle ne donne pas accès à l’argent de la boutique.</Alert>
      </>
    );
  const raw = await searchParams;
  const pageParam = raw.page;
  const period = resolvePeriod(raw, todayIn(organization.timezone), 'mois');
  const call = <T,>(path: string) =>
    apiAsUser<T>(accessToken, { path, organizationId: organization.id });
  const range = { from: period.from, to: period.to };
  const page = pageNumber(pageParam);
  const [expenses, wholePeriod, categories] = await Promise.all([
    call<ExpenseDto[]>(
      `/expenses?${new URLSearchParams({ ...range, ...pageParams(page) })}`,
    ),
    // The total counts the whole period, not only this page.
    call<ExpenseDto[]>(`/expenses?${new URLSearchParams(range)}`),
    call<ExpenseCategoryDto[]>('/expense-categories'),
  ]);
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  const canManage = roleHasPermission(organization.role, 'treasury.manage');
  const recorded = wholePeriod.ok
    ? wholePeriod.data.filter((e) => e.status === 'recorded')
    : [];
  const list = expenses.ok ? pageRows(expenses.data) : null;
  const periodParams = new URLSearchParams(
    period.key === 'perso'
      ? { du: period.from, au: period.to }
      : { periode: period.key },
  );

  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Ce que la boutique paie en dehors de la marchandise vendue."
      />

      {raw.enregistree === '1' && (
        <Alert tone="success">Dépense enregistrée.</Alert>
      )}
      {canManage && (
        <ButtonLink
          href="/espace/tresorerie/depenses/nouvelle"
          className="self-start"
        >
          <Plus aria-hidden className="size-5" />
          Nouvelle dépense
        </ButtonLink>
      )}

      <PeriodPicker
        path="/espace/tresorerie/depenses"
        current={period.key}
        from={period.from}
        to={period.to}
      />

      {!expenses.ok ? (
        <Alert tone="error">Dépenses indisponibles : {expenses.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState title="Aucune dépense sur cette période" />
      ) : (
        <>
          <p className="text-lg font-bold">
            Total :{' '}
            <span className="tabular-nums">
              {money(recorded.reduce((sum, e) => sum + e.amount, 0))}
            </span>
          </p>
          <ul aria-label="Liste des dépenses" className="flex flex-col gap-2">
            {list.rows.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-col gap-2 rounded-3xl bg-surface px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas"
                  >
                    {createElement(categoryIcon(expense.category.accountCode), {
                      className: 'size-5',
                    })}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">{expense.label}</span>
                    <span className="text-ink-muted">
                      {expense.number} ·{' '}
                      {formatCalendarDate(expense.occurredOn)} ·{' '}
                      {expense.category.name} · {expense.account.name}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-bold tabular-nums">
                      {money(expense.amount)}
                    </span>
                    {expense.status === 'cancelled' && (
                      <Badge tone="danger">Annulée</Badge>
                    )}
                  </span>
                </div>
                {expense.cancellation && (
                  <p className="text-ink-muted">
                    Annulée : {expense.cancellation.reason}
                  </p>
                )}
                {expense.receiptVersion && (
                  <a
                    href={`/espace/tresorerie/depenses/${expense.id}/justificatif?v=${expense.receiptVersion}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
                  >
                    Voir le justificatif de {expense.number}
                  </a>
                )}
                {canManage && (
                  <details>
                    <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-brand-ink">
                      {expense.receiptVersion
                        ? 'Changer le justificatif'
                        : 'Ajouter le justificatif (photo)'}
                    </summary>
                    <div className="pt-2">
                      <ReceiptForm
                        organizationId={organization.id}
                        expenseId={expense.id}
                        currentUrl={
                          expense.receiptVersion
                            ? `/espace/tresorerie/depenses/${expense.id}/justificatif?v=${expense.receiptVersion}`
                            : null
                        }
                      />
                    </div>
                  </details>
                )}
                {canManage && expense.status === 'recorded' && (
                  <details>
                    <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-danger-ink">
                      Annuler cette dépense
                    </summary>
                    <div className="pt-2">
                      <CancelExpenseForm
                        organizationId={organization.id}
                        expenseId={expense.id}
                        label={expense.label}
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination
        path="/espace/tresorerie/depenses"
        params={periodParams}
        page={page}
        hasNext={list?.hasNext ?? false}
      />

      <FoldCard title="Catégories de dépenses" icon={Tags}>
        {!categories.ok ? (
          <Alert tone="error">
            Catégories indisponibles : {categories.message}
          </Alert>
        ) : (
          <>
            <p className="mb-3 text-ink-muted">
              Chaque catégorie porte son compte SYSCOHADA, repris par le
              comptable.
            </p>
            <ul
              aria-labelledby="expense-categories"
              className="mb-4 flex flex-col divide-y divide-line"
            >
              {categories.data.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0"
                >
                  <span
                    className={
                      c.status === 'archived'
                        ? 'text-ink-muted'
                        : 'font-semibold'
                    }
                  >
                    {c.name}{' '}
                    <span className="font-normal text-ink-muted">
                      · compte {c.accountCode}
                    </span>
                    {c.status === 'archived' && ' · rangée'}
                  </span>
                  {canManage && (
                    <CategoryStatusButton
                      organizationId={organization.id}
                      categoryId={c.id}
                      name={c.name}
                      archived={c.status === 'archived'}
                    />
                  )}
                </li>
              ))}
            </ul>
            {canManage && <CategoryForm organizationId={organization.id} />}
          </>
        )}
      </FoldCard>
    </>
  );
}

export default function ExpensesPage(
  props: PageProps<'/espace/tresorerie/depenses'>,
) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <Expenses {...props} />
    </Suspense>
  );
}
