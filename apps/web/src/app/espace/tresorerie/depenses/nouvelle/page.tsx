import {
  roleHasPermission,
  type ExpenseCategoryDto,
  type TreasuryDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { accountOptions } from '@/lib/treasury/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ExpenseForm } from '../../forms';

export const metadata: Metadata = {
  title: 'Nouvelle dépense — Nagaw Business',
};

/** A new expense on its own screen, like a transfer (ADR-063). */
async function NewExpense() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'treasury.manage'))
    return (
      <>
        <PageHeader title="Nouvelle dépense" />
        <Alert>Votre rôle ne permet pas d’enregistrer une dépense.</Alert>
      </>
    );
  const call = <T,>(path: string) =>
    apiAsUser<T>(accessToken, { path, organizationId: organization.id });
  const [categories, treasury] = await Promise.all([
    call<ExpenseCategoryDto[]>('/expense-categories'),
    call<TreasuryDto>('/treasury'),
  ]);
  return (
    <>
      <PageHeader title="Nouvelle dépense" />
      {!categories.ok || !treasury.ok ? (
        <Alert tone="error">
          Dépenses indisponibles :{' '}
          {!categories.ok
            ? categories.message
            : !treasury.ok
              ? treasury.message
              : ''}
        </Alert>
      ) : (
        <div className="w-full max-w-md self-center">
          <ExpenseForm
            organizationId={organization.id}
            categories={categories.data
              .filter((c) => c.status === 'active')
              .map((c) => ({ value: c.id, label: c.name }))}
            accounts={accountOptions(treasury.data.accounts)}
            today={treasury.data.today.day}
            onSaved="/espace/tresorerie/depenses?enregistree=1"
          />
        </div>
      )}
    </>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={<PageFallback variant="form" />}>
      <NewExpense />
    </Suspense>
  );
}
