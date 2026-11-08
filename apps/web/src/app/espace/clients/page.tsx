import {
  formatAmount,
  roleHasPermission,
  type CustomerDto,
} from '@nagaw/shared';
import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CONTROL } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CustomerRow } from './customer-row';
import { NewCustomerFab } from './new-customer-fab';

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
  const canManage = roleHasPermission(organization.role, 'customers.manage');
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
              <CustomerRow
                key={customer.id}
                customer={customer}
                organizationId={organization.id}
                shopName={organization.name}
                countryCode={organization.phoneCountryCode}
                owed={customer.balance > 0 ? money(customer.balance) : null}
                canManage={canManage}
                canDocument={roleHasPermission(
                  organization.role,
                  'documents.manage',
                )}
              />
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

      {canManage && (
        <NewCustomerFab
          organizationId={organization.id}
          currency={organization.defaultCurrency}
        />
      )}
    </>
  );
}

export default function CustomersPage(props: PageProps<'/espace/clients'>) {
  return (
    <Suspense fallback={<PageFallback variant="list" />}>
      <Customers {...props} />
    </Suspense>
  );
}
