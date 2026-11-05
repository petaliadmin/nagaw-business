import {
  formatAmount,
  ORDER_VIEWS,
  roleHasPermission,
  showsModule,
  type OrderCountsDto,
  type OrderDto,
} from '@nagaw/shared';
import { ChevronRight, Link2, ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  ORDER_VIEW_LABELS,
  ORDER_VIEW_PARAMS,
  orderViewParam,
} from '@/lib/orders/labels';
import { pageNumber, pageParams, pageRows } from '@/lib/pagination';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Commandes — Nagaw Business' };

async function Orders({ searchParams }: PageProps<'/espace/commandes'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const query = await searchParams;
  const view =
    ORDER_VIEW_PARAMS[typeof query.vue === 'string' ? query.vue : ''] ?? 'open';
  const page = pageNumber(query.page);

  const [orders, counts] = await Promise.all([
    apiAsUser<OrderDto[]>(accessToken, {
      path: `/orders?${new URLSearchParams({ view, ...pageParams(page) })}`,
      organizationId: organization.id,
    }),
    apiAsUser<OrderCountsDto>(accessToken, {
      path: '/orders/counts',
      organizationId: organization.id,
    }),
  ]);
  const list = orders.ok ? pageRows(orders.data) : null;
  const listParams = new URLSearchParams({ vue: orderViewParam(view) });
  const badge = (v: (typeof ORDER_VIEWS)[number]) =>
    counts.ok && v !== 'all' && counts.data[v] > 0
      ? ` (${counts.data[v]})`
      : '';

  return (
    <>
      <PageHeader
        title="Commandes"
        description="Les commandes reçues par votre catalogue en ligne."
      />
      {roleHasPermission(organization.role, 'organization.update') && (
        <ButtonLink
          href="/espace/commandes/catalogue"
          variant="secondary"
          className="self-start"
        >
          <Link2 aria-hidden className="size-5" />
          Mon catalogue en ligne
        </ButtonLink>
      )}
      {!showsModule(organization.hiddenModules, 'orders') && (
        <Alert>
          « Commandes » n’est pas dans votre menu : affichez-le dans Paramètres
          pour recevoir des commandes.
        </Alert>
      )}

      <nav aria-label="Choisir les commandes" className="flex flex-wrap gap-2">
        {ORDER_VIEWS.map((v) => (
          <Link
            key={v}
            href={`/espace/commandes?vue=${orderViewParam(v)}`}
            aria-current={v === view ? 'true' : undefined}
            className={buttonClasses(
              v === view ? 'primary' : 'secondary',
              'shrink-0',
            )}
          >
            {ORDER_VIEW_LABELS[v]}
            {badge(v)}
          </Link>
        ))}
      </nav>

      {!orders.ok ? (
        <Alert tone="error">Commandes indisponibles : {orders.message}</Alert>
      ) : !list || list.rows.length === 0 ? (
        <EmptyState
          title={
            view === 'remind'
              ? 'Aucune commande à relancer'
              : 'Aucune commande ici pour le moment'
          }
        >
          Partagez le lien de votre catalogue sur WhatsApp ou Instagram : les
          commandes arrivent ici. Le lien est dans Paramètres.
        </EmptyState>
      ) : (
        <ul aria-label="Liste des commandes" className="flex flex-col gap-2">
          {list.rows.map((order) => (
            <li key={order.id}>
              <Link
                href={`/espace/commandes/${order.id}`}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-3 shadow-sm transition-colors hover:bg-surface-muted sm:px-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                  <ShoppingBag aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-bold break-words">
                    {order.customerName} · {order.customerArea}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-ink-muted">
                    <Badge tone={ORDER_STATUS_TONES[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                    {order.paidAt ? (
                      <Badge tone="success">Payée</Badge>
                    ) : order.status !== 'cancelled' ? (
                      <Badge tone="warning">Pas payée</Badge>
                    ) : null}
                    <span>
                      {order.reference} ·{' '}
                      {formatDateTime(order.createdAt, organization.timezone)}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-bold tabular-nums">
                  {formatAmount(order.total, order.currency)}
                </span>
                <ChevronRight
                  aria-hidden
                  className="hidden size-5 shrink-0 text-ink-muted sm:block"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        path="/espace/commandes"
        params={listParams}
        page={page}
        hasNext={list?.hasNext ?? false}
      />
    </>
  );
}

export default function OrdersPage(props: PageProps<'/espace/commandes'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Orders {...props} />
    </Suspense>
  );
}
