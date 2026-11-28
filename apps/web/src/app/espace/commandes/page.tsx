import {
  formatAmount,
  ORDER_STATUS_LABELS,
  roleHasPermission,
  type OrderDto,
} from '@nagaw/shared';
import { Globe, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { todayIn } from '@/lib/format';
import { dueLabel, ORDER_STATUS_TONES, orderPerson } from '@/lib/orders';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = { title: 'Commandes — Nagaw Business' };

function OrderCard({ order, currency }: { order: OrderDto; currency: string }) {
  return (
    <li>
      <Link
        href={`/espace/commandes/${order.id}`}
        className="flex flex-col gap-2 rounded-3xl bg-surface p-4 hover:ring-2 hover:ring-line hover:ring-inset"
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-bold">{orderPerson(order).name}</span>
          <Badge tone={ORDER_STATUS_TONES[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </span>
        <span className="text-ink-muted">
          {order.number} · {dueLabel(order)}
          {order.fulfilment === 'delivery' ? ' · livraison' : ''}
          {order.source === 'storefront' ? ' · vitrine' : ''}
        </span>
        <span className="flex flex-wrap items-center justify-between gap-2">
          {order.late ? <Badge tone="danger">En retard</Badge> : <span />}
          <span className="font-extrabold tabular-nums">
            {order.status === 'to_confirm'
              ? formatAmount(order.total, currency)
              : order.remaining > 0
                ? `Reste ${formatAmount(order.remaining, currency)}`
                : 'Payée'}
          </span>
        </span>
      </Link>
    </li>
  );
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function Orders({ searchParams }: Props) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const done = (await searchParams).vue === 'terminees';
  const orders = await apiAsUser<OrderDto[]>(accessToken, {
    path: `/orders?state=${done ? 'closed' : 'open'}`,
    organizationId: organization.id,
  });
  const today = todayIn(organization.timezone);
  const confirmed = orders.ok
    ? orders.data.filter((o) => o.status !== 'to_confirm')
    : [];
  const canTake =
    organization.ordersEnabled &&
    roleHasPermission(organization.role, 'orders.manage');
  const groups = orders.ok
    ? done
      ? [{ title: 'Remises et annulées', rows: orders.data }]
      : [
          // Sent from the storefront (ADR-075): the shop answers first.
          {
            title: 'À confirmer',
            rows: orders.data.filter((o) => o.status === 'to_confirm'),
          },
          ...[
            { title: 'En retard', rows: confirmed.filter((o) => o.late) },
            {
              title: 'Aujourd’hui',
              rows: confirmed.filter((o) => o.dueOn === today),
            },
            {
              title: 'À venir',
              rows: confirmed.filter((o) => o.dueOn > today),
            },
          ],
        ]
    : [];
  return (
    <>
      <PageHeader
        title="Commandes"
        description="Ce que vos clients recevront plus tard."
        actions={
          <>
            {roleHasPermission(organization.role, 'storefront.manage') && (
              <ButtonLink href="/espace/vitrine" variant="secondary">
                <Globe aria-hidden className="size-5" />
                Ma vitrine
              </ButtonLink>
            )}
            {canTake && (
              <ButtonLink href="/espace/commandes/nouvelle">
                <Plus aria-hidden className="size-5" />
                Nouvelle commande
              </ButtonLink>
            )}
          </>
        }
      />
      {!organization.ordersEnabled && (
        <Alert>
          Les commandes sont éteintes : celles en cours restent ici jusqu’à leur
          remise ou leur annulation. Le propriétaire les rallume dans Paramètres
          › Mon application.
        </Alert>
      )}
      <nav aria-label="Commandes" className="flex gap-2">
        <Link
          href="/espace/commandes"
          aria-current={done ? undefined : 'page'}
          className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${done ? 'border-transparent bg-surface' : 'border-ink bg-canvas'}`}
        >
          À remettre
        </Link>
        <Link
          href="/espace/commandes?vue=terminees"
          aria-current={done ? 'page' : undefined}
          className={`min-h-12 rounded-full border-2 px-4 py-2.5 font-bold ${done ? 'border-ink bg-canvas' : 'border-transparent bg-surface'}`}
        >
          Terminées
        </Link>
      </nav>
      {!orders.ok ? (
        <Alert tone="error">Commandes indisponibles : {orders.message}</Alert>
      ) : orders.data.length === 0 ? (
        <EmptyState
          title={
            done ? 'Aucune commande terminée' : 'Aucune commande à remettre'
          }
        >
          {canTake && !done && (
            <Link
              href="/espace/commandes/nouvelle"
              className="font-semibold text-brand-ink underline"
            >
              Prendre une commande
            </Link>
          )}
        </EmptyState>
      ) : (
        groups
          .filter((g) => g.rows.length > 0)
          .map((group) => (
            <section
              key={group.title}
              aria-label={group.title}
              className="flex flex-col gap-3"
            >
              <h2 className="text-lg font-extrabold">{group.title}</h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.rows.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    currency={organization.defaultCurrency}
                  />
                ))}
              </ul>
            </section>
          ))
      )}
    </>
  );
}

export default function OrdersPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Orders {...props} />
    </Suspense>
  );
}
