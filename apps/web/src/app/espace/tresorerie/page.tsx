import {
  formatAmount,
  roleHasPermission,
  type TreasuryDto,
} from '@nagaw/shared';
import {
  ArrowLeftRight,
  Banknote,
  Calculator,
  Landmark,
  Receipt,
  Smartphone,
  Wallet,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, Stat } from '@/components/ui/card';
import { Figure } from '@/components/ui/figure';
import { FoldCard } from '@/components/ui/fold-card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { accountOptions } from '@/lib/treasury/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { TransferForm } from './forms';

export const metadata: Metadata = { title: 'Trésorerie — Nagaw Business' };

const ICONS = {
  cash: Banknote,
  mobile_money: Smartphone,
  bank: Landmark,
} as const;

async function Treasury({ searchParams }: PageProps<'/espace/tresorerie'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'treasury.read'))
    return (
      <>
        <PageHeader title="Trésorerie" />
        <Alert>Votre rôle ne donne pas accès à l’argent de la boutique.</Alert>
      </>
    );
  const all = (await searchParams).toutes === '1';
  const result = await apiAsUser<TreasuryDto>(accessToken, {
    path: '/treasury',
    organizationId: organization.id,
  });
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const canManage = roleHasPermission(organization.role, 'treasury.manage');

  if (!result.ok)
    return (
      <>
        <PageHeader title="Trésorerie" />
        <Alert tone="error">Trésorerie indisponible : {result.message}</Alert>
      </>
    );
  const t = result.data;
  const shown = all
    ? t.accounts
    : t.accounts.filter((a) => a.used || a.balance !== 0);
  const hidden = t.accounts.length - shown.length;

  return (
    <>
      <PageHeader
        title="Trésorerie"
        description="L’argent de la boutique, caisse par caisse."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/espace/tresorerie/cloture">
              <Calculator aria-hidden className="size-5" />
              Clôturer la caisse
            </ButtonLink>
            <ButtonLink href="/espace/tresorerie/depenses" variant="secondary">
              <Receipt aria-hidden className="size-5" />
              Dépenses
            </ButtonLink>
          </div>
        }
      />

      <section
        aria-labelledby="treasury-total"
        className="flex flex-col gap-2 rounded-2xl bg-accounting-soft p-4 text-accounting-ink md:p-6"
      >
        <h2 id="treasury-total" className="text-lg font-bold">
          Total de la trésorerie
        </h2>
        <div className="@container font-extrabold tabular-nums [--figure-max:2.25rem]">
          <Figure value={money(t.total)} />
        </div>
        <p>
          Aujourd’hui : {money(t.today.moneyIn)} entrés,{' '}
          {money(t.today.moneyOut)} sortis.
        </p>
      </section>

      <section aria-labelledby="accounts-title" className="flex flex-col gap-3">
        <h2 id="accounts-title" className="text-xl font-bold">
          Caisses
        </h2>
        <ul
          aria-labelledby="accounts-title"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {shown.map((account) => {
            const Icon = ICONS[account.kind];
            return (
              <li key={account.id}>
                <Link
                  href={`/espace/tresorerie/${account.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accounting-soft text-accounting-ink">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span className="font-bold">{account.name}</span>
                  </span>
                  <span
                    className={`text-lg font-extrabold tabular-nums ${account.balance < 0 ? 'text-danger-ink' : ''}`}
                  >
                    {money(account.balance)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {hidden > 0 && (
          <Link
            href="/espace/tresorerie?toutes=1"
            className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
          >
            Voir les {hidden} autres caisses (encore vides)
          </Link>
        )}
      </section>

      <Card title="On vous doit" titleId="receivables" icon={Wallet}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat
            label="Crédit des clients"
            value={money(t.receivables.customers)}
          />
          <Stat
            label="Factures à encaisser"
            value={money(t.receivables.invoices)}
          />
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href="/espace/clients?doivent=1" variant="secondary">
            Clients qui doivent
          </ButtonLink>
          {roleHasPermission(organization.role, 'documents.read') && (
            <ButtonLink href="/espace/factures" variant="secondary">
              Factures
            </ButtonLink>
          )}
        </div>
      </Card>

      {canManage && (
        <FoldCard title="Déplacer de l’argent" icon={ArrowLeftRight}>
          <p className="mb-4 text-ink-muted">
            Pour un dépôt à la banque ou un retrait Mobile Money : l’argent
            change de caisse, il ne sort pas de la boutique.
          </p>
          <TransferForm
            organizationId={organization.id}
            accounts={accountOptions(t.accounts)}
            today={t.today.day}
          />
        </FoldCard>
      )}
    </>
  );
}

export default function TreasuryPage(props: PageProps<'/espace/tresorerie'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Treasury {...props} />
    </Suspense>
  );
}
