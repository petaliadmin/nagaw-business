import {
  formatAmount,
  roleHasPermission,
  type AuditLogDto,
  type MemberDto,
  type Paginated,
  type SalesDaySummaryDto,
  type StockSummaryDto,
} from '@nagaw/shared';
import {
  CalendarDays,
  History,
  Package,
  ShoppingCart,
  Store,
  UserPlus,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import type { ApiResult } from '@/lib/api/call-api';
import { apiAsUser } from '@/lib/api/server';
import {
  formatQuantity,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
} from '@/lib/catalog/labels';
import { formatDate, formatDateTime } from '@/lib/format';
import { ROLE_LABELS, auditActionLabel } from '@/lib/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Accueil — Nagaw Business' };

/** Today's sales, with the shortcut to the checkout. */
function TodayCard({
  summary,
  currency,
  canSell,
}: {
  summary: ApiResult<SalesDaySummaryDto>;
  currency: string;
  canSell: boolean;
}) {
  return (
    <Card title="Aujourd’hui" titleId="today" icon={CalendarDays}>
      <div className="flex flex-col gap-4">
        {!summary.ok ? (
          <Alert tone="error">Ventes indisponibles : {summary.message}</Alert>
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Ventes" value={summary.data.count} />
            <Stat
              label="Montant des ventes"
              value={formatAmount(summary.data.total, currency)}
            />
          </dl>
        )}
        <div className="flex flex-wrap gap-3">
          {canSell && (
            <ButtonLink
              href="/espace/vendre"
              variant="sell"
              className="min-h-16 px-8 text-xl"
            >
              <ShoppingCart aria-hidden className="size-6" />
              Vendre
            </ButtonLink>
          )}
          <ButtonLink href="/espace/ventes" variant="secondary">
            Voir les ventes du jour
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

/** Stock at a glance: what is running out, and what the stock is worth. */
function StockCard({
  summary,
  currency,
  canManage,
}: {
  summary: ApiResult<StockSummaryDto>;
  currency: string;
  canManage: boolean;
}) {
  return (
    <Card title="Stock" titleId="stock-summary" icon={Package}>
      {!summary.ok ? (
        <Alert tone="error">Stock indisponible : {summary.message}</Alert>
      ) : summary.data.trackedProducts === 0 ? (
        <EmptyState title="Aucun produit suivi pour le moment">
          {canManage ? (
            <Link
              href="/espace/produits/nouveau"
              className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
            >
              Ajouter votre premier produit
            </Link>
          ) : (
            'Le propriétaire ou un gérant peut ajouter les produits.'
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Épuisés" value={summary.data.outOfStock} />
            <Stat label="Bientôt épuisés" value={summary.data.lowStock} />
            <Stat
              label="Valeur du stock (prix d’achat)"
              value={formatAmount(summary.data.stockValue, currency)}
            />
          </dl>
          {summary.data.unvaluedProducts > 0 && (
            <p className="text-ink-muted">
              {summary.data.unvaluedProducts} produit
              {summary.data.unvaluedProducts > 1 ? 's' : ''} en stock sans prix
              d’achat ne {summary.data.unvaluedProducts > 1 ? 'sont' : 'est'}{' '}
              pas compté{summary.data.unvaluedProducts > 1 ? 's' : ''} dans la
              valeur.
            </p>
          )}
          {summary.data.alerts.length > 0 && (
            <ul
              aria-label="Produits à racheter"
              className="flex flex-col gap-2"
            >
              {summary.data.alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={`/espace/produits/${alert.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2"
                  >
                    <span className="font-semibold">{alert.name}</span>
                    <Badge tone={STOCK_LEVEL_TONES[alert.stockLevel]}>
                      {alert.stockLevel === 'out'
                        ? STOCK_LEVEL_LABELS.out
                        : `Reste ${formatQuantity(alert.stockQuantity, alert.unit)}`}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/espace/produits"
            className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
          >
            Voir tous les produits
          </Link>
        </div>
      )}
    </Card>
  );
}

async function Overview() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canReadAudit = roleHasPermission(organization.role, 'audit.read');
  const canInvite = roleHasPermission(organization.role, 'members.invite');
  const canManageCatalog = roleHasPermission(
    organization.role,
    'catalog.manage',
  );

  const [members, sales, stock, audit] = await Promise.all([
    apiAsUser<MemberDto[]>(accessToken, {
      path: '/organizations/current/members',
      organizationId: organization.id,
    }),
    apiAsUser<SalesDaySummaryDto>(accessToken, {
      path: '/sales/summary',
      organizationId: organization.id,
    }),
    apiAsUser<StockSummaryDto>(accessToken, {
      path: '/stock/summary',
      organizationId: organization.id,
    }),
    canReadAudit
      ? apiAsUser<Paginated<AuditLogDto>>(accessToken, {
          path: '/audit-logs?limit=5',
          organizationId: organization.id,
        })
      : null,
  ]);

  const activeMembers = members.ok
    ? members.data.filter((member) => member.status === 'active')
    : [];
  const emailById = new Map(
    members.ok ? members.data.map((m) => [m.userId, m.email]) : [],
  );

  return (
    <>
      <PageHeader
        title={organization.name}
        description={`Boutique créée le ${formatDate(organization.createdAt, organization.timezone)}`}
        actions={
          canInvite ? (
            <ButtonLink href="/espace/equipe">
              <UserPlus aria-hidden className="size-5" />
              Inviter quelqu’un
            </ButtonLink>
          ) : undefined
        }
      />

      <TodayCard
        summary={sales}
        currency={organization.defaultCurrency}
        canSell={roleHasPermission(organization.role, 'sales.create')}
      />

      <Card title="Votre boutique" titleId="org-summary" icon={Store}>
        {members.ok ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Personnes dans l’équipe"
              value={activeMembers.length}
            />
            <Stat label="Votre rôle" value={ROLE_LABELS[organization.role]} />
            <Stat
              label="Fuseau horaire · devise"
              value={`${organization.timezone} · ${organization.defaultCurrency}`}
            />
          </dl>
        ) : (
          <Alert tone="error">Équipe indisponible : {members.message}</Alert>
        )}
      </Card>

      <StockCard
        summary={stock}
        currency={organization.defaultCurrency}
        canManage={canManageCatalog}
      />

      <Card title="Activité récente" titleId="recent-activity" icon={History}>
        {!audit ? (
          <p className="text-ink-muted">
            Votre rôle ne donne pas accès à l’historique.
          </p>
        ) : !audit.ok ? (
          <Alert tone="error">Activité indisponible : {audit.message}</Alert>
        ) : audit.data.data.length === 0 ? (
          <EmptyState title="Aucune activité pour le moment" />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-line">
              {audit.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 first:pt-0"
                >
                  <span className="font-semibold">
                    {auditActionLabel(entry.action)}
                    {entry.actorId && emailById.has(entry.actorId) && (
                      <span className="font-normal text-ink-muted">
                        {' '}
                        — {emailById.get(entry.actorId)}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    className="text-ink-muted tabular-nums"
                  >
                    {formatDateTime(entry.createdAt, organization.timezone)}
                  </time>
                </li>
              ))}
            </ul>
            <Link
              href="/espace/journal"
              className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
            >
              Voir tout l’historique
            </Link>
          </div>
        )}
      </Card>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Overview />
    </Suspense>
  );
}
