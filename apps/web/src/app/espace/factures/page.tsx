import {
  formatAmount,
  roleHasPermission,
  type DocumentStatsDto,
} from '@nagaw/shared';
import {
  Banknote,
  CalendarDays,
  CircleCheck,
  Clock,
  FilePlus2,
  FileText,
  HandCoins,
  TriangleAlert,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { KpiTile } from '@/components/dashboard/kpi';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Factures et devis — Nagaw Business',
};

const LINK =
  'inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4';

const documents = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? 's' : ''}`;

/** Figures of all the invoices and quotes, computed by the API. */
async function Summary({ searchParams }: PageProps<'/espace/factures'>) {
  // Former address of the list of quotes.
  if ((await searchParams).type === 'devis') redirect('/espace/factures/devis');
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  // The shop's totals are not for sellers (ADR-036): their list instead.
  if (!roleHasPermission(organization.role, 'stats.read'))
    redirect('/espace/factures/liste');
  const stats = await apiAsUser<DocumentStatsDto>(accessToken, {
    path: '/documents/stats',
    organizationId: organization.id,
  });
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  const canManage = roleHasPermission(organization.role, 'documents.manage');
  const canQuote = roleHasPermission(organization.role, 'quotes.manage');

  return (
    <>
      <PageHeader
        title="Factures et devis"
        description="Ce que vous avez facturé, ce qu’on vous doit, et vos devis en cours."
        actions={
          canManage ? (
            <ButtonLink href="/espace/factures/nouvelle">
              <FilePlus2 aria-hidden className="size-5" />
              Nouvelle facture
            </ButtonLink>
          ) : canQuote ? (
            <ButtonLink href="/espace/factures/devis/nouveau">
              <FileText aria-hidden className="size-5" />
              Nouveau devis
            </ButtonLink>
          ) : undefined
        }
      />
      {!stats.ok ? (
        <Alert tone="error">Chiffres indisponibles : {stats.message}</Alert>
      ) : (
        <>
          <Card
            title="Factures"
            titleId="invoice-figures"
            icon={FilePlus2}
            tone="invoices"
          >
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <KpiTile
                  label="Facturé"
                  value={money(stats.data.invoices.total)}
                  tone="invoices"
                  icon={FileText}
                >
                  <p className="text-base">
                    {documents(stats.data.invoices.count, 'facture')}
                  </p>
                </KpiTile>
                <KpiTile
                  label="Ce mois-ci"
                  value={money(stats.data.invoices.monthTotal)}
                  tone="stats"
                  icon={CalendarDays}
                />
                <KpiTile
                  label="Encaissé"
                  value={money(stats.data.invoices.paid)}
                  tone="sales"
                  icon={Banknote}
                />
                <KpiTile
                  label="Reste à encaisser"
                  value={money(stats.data.invoices.balance)}
                  tone="stock"
                  icon={HandCoins}
                />
              </dl>
              {stats.data.invoices.overdueCount > 0 && (
                <Alert tone="warning">
                  <TriangleAlert
                    aria-hidden
                    className="mr-2 inline size-5 align-text-bottom"
                  />
                  {documents(stats.data.invoices.overdueCount, 'facture')} en
                  retard : {money(stats.data.invoices.overdueAmount)} à
                  relancer.
                </Alert>
              )}
              {stats.data.invoices.drafts > 0 && (
                <p className="text-ink-muted">
                  {documents(stats.data.invoices.drafts, 'brouillon')} à
                  terminer.
                </p>
              )}
              <Link href="/espace/factures/liste" className={LINK}>
                Voir toutes les factures
              </Link>
            </div>
          </Card>

          <Card
            title="Devis"
            titleId="quote-figures"
            icon={FileText}
            tone="invoices"
          >
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                <KpiTile
                  label="En attente de réponse"
                  value={money(stats.data.quotes.pendingAmount)}
                  tone="stock"
                  icon={Clock}
                >
                  <p className="text-base">
                    {stats.data.quotes.pendingCount} devis
                  </p>
                </KpiTile>
                <KpiTile
                  label="Acceptés"
                  value={money(stats.data.quotes.acceptedAmount)}
                  tone="sales"
                  icon={CircleCheck}
                >
                  <p className="text-base">
                    {stats.data.quotes.acceptedCount} devis
                  </p>
                </KpiTile>
                <KpiTile
                  label="Refusés"
                  value={stats.data.quotes.refusedCount}
                  tone="accounting"
                  icon={TriangleAlert}
                />
              </dl>
              {stats.data.quotes.expiredCount > 0 && (
                <p className="text-ink-muted">
                  {stats.data.quotes.expiredCount} devis expiré
                  {stats.data.quotes.expiredCount > 1 ? 's' : ''} sans réponse.
                </p>
              )}
              <Link href="/espace/factures/devis" className={LINK}>
                Voir tous les devis
              </Link>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

export default function DocumentsSummaryPage(
  props: PageProps<'/espace/factures'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Summary {...props} />
    </Suspense>
  );
}
