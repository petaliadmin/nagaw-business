import {
  formatAmount,
  roleHasPermission,
  type CustomerDto,
} from '@nagaw/shared';
import { Search, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CONTROL } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { FoldCard } from '@/components/ui/fold-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CustomerForm } from './customer-forms';

export const metadata: Metadata = { title: 'Clients — Nagaw Business' };

async function Customers({ searchParams }: PageProps<'/espace/clients'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const raw = await searchParams;
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  const owing = raw.doivent === '1';
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (owing) query.set('owing', 'true');
  const filters = new URLSearchParams();
  if (q) filters.set('q', q);
  if (owing) filters.set('doivent', '1');
  const page = pageNumber(raw.page);
  const [customers, debtors] = await Promise.all([
    apiAsUser<CustomerDto[]>(accessToken, {
      path: `/customers?${new URLSearchParams([
        ...query,
        ...Object.entries(pageParams(page)),
      ])}`,
      organizationId: organization.id,
    }),
    // The total counts everyone, not only the people of this page.
    owing
      ? apiAsUser<CustomerDto[]>(accessToken, {
          path: `/customers?${query}`,
          organizationId: organization.id,
        })
      : null,
  ]);
  const list = customers.ok ? pageRows(customers.data) : null;
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  const owed = debtors?.ok
    ? debtors.data.reduce((sum, c) => sum + Math.max(c.balance, 0), 0)
    : 0;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Vos clients habitués, et ce qu’ils vous doivent."
      />

      <form action="/espace/clients" role="search" className="flex gap-2">
        {owing && <input type="hidden" name="doivent" value="1" />}
        <label htmlFor="customer-search" className="sr-only">
          Chercher un client par nom ou téléphone
        </label>
        <input
          id="customer-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom ou téléphone"
          className={`${CONTROL} min-w-0 flex-1`}
        />
        <button type="submit" className={buttonClasses('secondary')}>
          <Search aria-hidden className="size-5" />
          Chercher
        </button>
      </form>
      <nav aria-label="Filtrer les clients" className="flex flex-wrap gap-2">
        <Link
          href="/espace/clients"
          aria-current={!owing ? 'true' : undefined}
          className={buttonClasses(!owing ? 'primary' : 'secondary')}
        >
          Tous
        </Link>
        <Link
          href="/espace/clients?doivent=1"
          aria-current={owing ? 'true' : undefined}
          className={buttonClasses(owing ? 'primary' : 'secondary')}
        >
          Ils me doivent
        </Link>
      </nav>

      {!customers.ok ? (
        <Alert tone="error">Clients indisponibles : {customers.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState
          title={
            owing ? 'Personne ne vous doit rien' : 'Aucun client pour le moment'
          }
        />
      ) : (
        <>
          {debtors?.ok && (
            <p className="text-lg font-bold">
              Total à récupérer :{' '}
              <span className="text-warning-ink">{money(owed)}</span>
            </p>
          )}
          <ul aria-label="Liste des clients" className="flex flex-col gap-2">
            {list.rows.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/espace/clients/${customer.id}`}
                  className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                >
                  <span className="flex flex-col">
                    <span className="font-bold">{customer.name}</span>
                    {customer.phone && (
                      <span className="text-ink-muted">{customer.phone}</span>
                    )}
                  </span>
                  {customer.balance > 0 ? (
                    <Badge tone="warning">Doit {money(customer.balance)}</Badge>
                  ) : (
                    <Badge tone="success">Ne doit rien</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination
        path="/espace/clients"
        params={filters}
        page={page}
        hasNext={list?.hasNext ?? false}
      />

      {roleHasPermission(organization.role, 'customers.manage') && (
        <FoldCard title="Ajouter un client" icon={UserPlus}>
          <CustomerForm
            organizationId={organization.id}
            currency={organization.defaultCurrency}
          />
        </FoldCard>
      )}
    </>
  );
}

export default function CustomersPage(props: PageProps<'/espace/clients'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Customers {...props} />
    </Suspense>
  );
}
