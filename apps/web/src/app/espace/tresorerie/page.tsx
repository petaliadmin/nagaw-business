import {
  formatAmount,
  roleHasPermission,
  type TreasuryDto,
} from '@nagaw/shared';
import { ArrowLeftRight, Calculator, Receipt, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HideAmountsButton } from '@/components/ui/hide-amounts';
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
import { AccountIcon } from '@/components/treasury/account-icon';
import { TransferForm } from './forms';

export const metadata: Metadata = { title: 'Trésorerie — Nagaw Business' };

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
  const params = await searchParams;
  const all = params.toutes === '1';
  // « Déplacer » opens the transfer form right away.
  const moving = params.deplacer === '1';
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
        title="Argent"
        description="L’argent de la boutique, caisse par caisse."
      />

      {/* The answer first, blurred by « Masquer », then the gestures of
          every day in round buttons (ADR-063). */}
      <section aria-labelledby="treasury-total" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="treasury-total"
            className="text-base font-bold text-ink-muted"
          >
            Total de la trésorerie
          </h2>
          <HideAmountsButton tone="light" />
        </div>
        <div className="montant-prive @container font-extrabold tracking-tight tabular-nums [--figure-max:2.75rem]">
          <Figure value={money(t.total)} />
        </div>
        <p className="text-base text-ink-muted">
          Aujourd’hui : {money(t.today.moneyIn)} entrés,{' '}
          {money(t.today.moneyOut)} sortis.
        </p>
      </section>

      <nav aria-label="Actions sur l’argent">
        <ul className="grid grid-cols-3 gap-2 sm:max-w-md">
          {canManage && (
            <li>
              <Link
                href="/espace/tresorerie/cloture"
                className="flex flex-col items-center gap-2 py-1 text-center text-base leading-tight font-bold"
              >
                <span className="flex size-15 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                  <Calculator aria-hidden className="size-6" />
                </span>
                Clôturer la journée
              </Link>
            </li>
          )}
          <li>
            <Link
              href="/espace/tresorerie/depenses"
              className="flex flex-col items-center gap-2 py-1 text-center text-base leading-tight font-bold"
            >
              <span className="flex size-15 items-center justify-center rounded-full bg-stats-soft text-stats-ink">
                <Receipt aria-hidden className="size-6" />
              </span>
              Dépenses
            </Link>
          </li>
          {canManage && (
            <li>
              <Link
                href="/espace/tresorerie?deplacer=1#deplacer"
                className="flex flex-col items-center gap-2 py-1 text-center text-base leading-tight font-bold"
              >
                <span className="flex size-15 items-center justify-center rounded-full bg-stock-soft text-stock-ink">
                  <ArrowLeftRight aria-hidden className="size-6" />
                </span>
                Déplacer
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <section aria-labelledby="accounts-title" className="flex flex-col gap-3">
        <h2 id="accounts-title" className="text-xl font-bold">
          Mes caisses
        </h2>
        {/* One card per account, the main one dark (ADR-063). */}
        <ul
          aria-labelledby="accounts-title"
          className="grid grid-cols-2 gap-3 lg:grid-cols-3"
        >
          {shown.map((account, index) => {
            const first = index === 0;
            return (
              <li key={account.id}>
                <Link
                  href={`/espace/tresorerie/${account.id}`}
                  className={`@container flex min-h-32 flex-col justify-between gap-3 rounded-3xl p-4 ${
                    first ? 'bg-ink text-canvas' : 'bg-surface'
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <AccountIcon account={account} />
                    <span className="min-w-0 break-words">{account.name}</span>
                  </span>
                  <span
                    className={`montant-prive font-extrabold tabular-nums ${
                      account.balance < 0 && !first ? 'text-danger-ink' : ''
                    }`}
                  >
                    <Figure
                      value={money(account.balance)}
                      className="[--figure-max:1.375rem]"
                    />
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
        <div id="deplacer" className="scroll-mt-20">
          <FoldCard
            title="Déplacer de l’argent"
            icon={ArrowLeftRight}
            defaultOpen={moving}
          >
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
        </div>
      )}
    </>
  );
}

export default function TreasuryPage(props: PageProps<'/espace/tresorerie'>) {
  return (
    <Suspense fallback={<PageFallback variant="dashboard" />}>
      <Treasury {...props} />
    </Suspense>
  );
}
