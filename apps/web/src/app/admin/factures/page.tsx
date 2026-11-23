import {
  formatAmount,
  SUBSCRIPTION_PERIOD_LABELS,
  type AdminInvoiceDto,
} from '@nagaw/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { InvoiceDecision } from '../forms';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Subscription invoices to collect, late ones first (ADR-073). */
async function Invoices({ searchParams }: Props) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const all = (await searchParams).vue === 'toutes';
  const invoices = await apiAsUser<AdminInvoiceDto[]>(admin.accessToken, {
    path: `/admin/invoices?status=${all ? 'all' : 'pending'}`,
  });
  const when = (iso: string) => formatDateTime(iso, 'UTC');
  return (
    <>
      <PageHeader
        title="Factures d’abonnement"
        description="Marquez une facture payée dès que l’argent est reçu : une boutique suspendue pour impayé rouvre aussitôt."
      />
      <nav aria-label="Factures" className="flex gap-2">
        <Link
          href="/admin/factures"
          aria-current={all ? undefined : 'page'}
          className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${all ? 'border-transparent bg-surface' : 'border-ink bg-canvas'}`}
        >
          À encaisser
        </Link>
        <Link
          href="/admin/factures?vue=toutes"
          aria-current={all ? 'page' : undefined}
          className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${all ? 'border-ink bg-canvas' : 'border-transparent bg-surface'}`}
        >
          Toutes
        </Link>
      </nav>
      {!invoices.ok ? (
        <Alert tone="error">Factures indisponibles : {invoices.message}</Alert>
      ) : invoices.data.length === 0 ? (
        <EmptyState title={all ? 'Aucune facture' : 'Rien à encaisser'} />
      ) : (
        <ul aria-label="Factures" className="flex flex-col gap-3">
          {invoices.data.map((i) => (
            <li
              key={i.id}
              className="flex flex-col gap-2 rounded-3xl bg-surface p-4"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/boutiques/${i.shop.id}`}
                  className="text-lg font-bold underline underline-offset-4"
                >
                  {i.shop.name}
                </Link>
                <span className="flex flex-wrap gap-2">
                  {i.overdue && <Badge tone="danger">En retard</Badge>}
                  {i.shop.status === 'suspended' && (
                    <Badge tone="warning">Boutique suspendue</Badge>
                  )}
                  {i.status !== 'pending' && (
                    <Badge tone={i.status === 'paid' ? 'success' : 'neutral'}>
                      {i.status === 'paid' ? 'Payée' : 'Annulée'}
                    </Badge>
                  )}
                </span>
              </span>
              <span>
                <strong className="tabular-nums">
                  {formatAmount(i.amount, i.currency)}
                </strong>{' '}
                · {i.plan.name}, {SUBSCRIPTION_PERIOD_LABELS[i.period]} ·{' '}
                {i.reference}
              </span>
              <span className="text-ink-muted">
                {i.status === 'pending'
                  ? `À payer avant le ${when(i.dueAt)} (UTC)`
                  : `Du ${when(i.periodStart)} au ${when(i.periodEnd)} (UTC)`}
              </span>
              {i.status === 'pending' && (
                <InvoiceDecision invoice={i} shopName={i.shop.name} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function InvoicesPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Invoices {...props} />
    </Suspense>
  );
}
