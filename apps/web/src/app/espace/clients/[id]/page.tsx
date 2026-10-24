import {
  formatAmount,
  roleHasPermission,
  type CustomerDetailDto,
} from '@nagaw/shared';
import { HandCoins, History, Pencil, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { PAYMENT_LABELS, ticketNumber } from '@/lib/sales/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CustomerForm, RepaymentForm } from '../customer-forms';

export const metadata: Metadata = { title: 'Client — Nagaw Business' };

async function Customer({ params }: PageProps<'/espace/clients/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const customer = await apiAsUser<CustomerDetailDto>(accessToken, {
    path: `/customers/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!customer.ok && customer.status === 404) notFound();
  if (!customer.ok)
    return <Alert tone="error">Client indisponible : {customer.message}</Alert>;
  const c = customer.data;
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const canManage = roleHasPermission(organization.role, 'customers.manage');

  return (
    <>
      <PageHeader title={c.name} description={c.notes || undefined} />
      {c.phone && (
        <div className="flex flex-wrap gap-3">
          <a
            href={`tel:${c.phone.replace(/\s/g, '')}`}
            className={buttonClasses('secondary')}
          >
            <Phone aria-hidden className="size-5" />
            Appeler le {c.phone}
          </a>
        </div>
      )}

      <section
        aria-labelledby="balance-title"
        className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-6"
      >
        <h2 id="balance-title" className="text-xl font-bold">
          Ce que le client doit
        </h2>
        <p
          className={`text-4xl font-extrabold tabular-nums ${c.balance > 0 ? 'text-warning-ink' : 'text-sales-ink'}`}
        >
          {money(c.balance)}
        </p>
        {c.creditLimit !== null && (
          <p className="text-ink-muted">
            Crédit maximum : {money(c.creditLimit)}
          </p>
        )}
      </section>

      {canManage && c.balance > 0 && (
        <Card title="Le client rembourse" titleId="repay" icon={HandCoins}>
          <RepaymentForm
            organizationId={organization.id}
            currency={currency}
            customer={c}
          />
        </Card>
      )}

      <Card
        title="Achats à crédit et remboursements"
        titleId="activity"
        icon={History}
      >
        {c.activity.length === 0 ? (
          <EmptyState title="Rien pour le moment" />
        ) : (
          <ul
            aria-label="Historique du client"
            className="flex flex-col divide-y divide-line"
          >
            {c.activity.map((entry) => (
              <li
                key={`${entry.kind}-${entry.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
              >
                <span className="flex flex-col">
                  {entry.kind === 'credit_sale' ? (
                    <Link
                      href={`/espace/ventes/${entry.id}`}
                      className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
                    >
                      Achat à crédit, ticket{' '}
                      {ticketNumber(entry.saleNumber ?? 0)}
                    </Link>
                  ) : (
                    <span className="font-semibold">
                      Remboursement (
                      {entry.method ? PAYMENT_LABELS[entry.method] : ''})
                    </span>
                  )}
                  <span className="text-ink-muted">
                    {formatDateTime(entry.at, organization.timezone)}
                  </span>
                </span>
                <span
                  className={`text-lg font-extrabold tabular-nums ${entry.kind === 'credit_sale' ? 'text-warning-ink' : 'text-sales-ink'}`}
                >
                  {entry.kind === 'credit_sale' ? '+' : '−'}
                  {money(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && (
        <Card title="Modifier le client" titleId="edit-customer" icon={Pencil}>
          <CustomerForm
            organizationId={organization.id}
            currency={currency}
            customer={c}
          />
        </Card>
      )}
    </>
  );
}

export default function CustomerPage(props: PageProps<'/espace/clients/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Customer {...props} />
    </Suspense>
  );
}
