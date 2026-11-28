import {
  formatAmount,
  isOpenOrder,
  ORDER_STATUS_LABELS,
  roleHasPermission,
  type CustomerDto,
  type OrderDto,
} from '@nagaw/shared';
import { MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import {
  dueLabel,
  ORDER_STATUS_TONES,
  orderPerson,
  orderText,
} from '@/lib/orders';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';
import { whatsappLink } from '@/lib/sales/ticket';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ConfirmActions } from './confirm-actions';
import {
  CancelForm,
  DeliverForm,
  DepositForm,
  StatusSteps,
} from './order-actions';

export const metadata: Metadata = { title: 'Commande — Nagaw Business' };

type Props = { params: Promise<{ id: string }> };

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? 'text-lg font-extrabold' : ''}`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

async function Order({ params }: Props) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const result = await apiAsUser<OrderDto>(accessToken, {
    path: `/orders/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok)
    return <Alert tone="error">Commande indisponible : {result.message}</Alert>;
  const order = result.data;
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const role = organization.role;
  const open = isOpenOrder(order.status);
  const canManage = roleHasPermission(role, 'orders.manage');
  const canDeliver = canManage && roleHasPermission(role, 'sales.create');
  const person = orderPerson(order);
  const toConfirm = order.status === 'to_confirm';
  // A customer with the same number, proposed when accepting (ADR-075).
  let match: { id: string; name: string } | null = null;
  const digits = person.phone.replace(/\D/g, '').slice(-8);
  if (
    toConfirm &&
    canManage &&
    digits.length === 8 &&
    roleHasPermission(role, 'customers.read')
  ) {
    const found = await apiAsUser<CustomerDto[]>(accessToken, {
      path: `/customers?q=${digits}&limit=5`,
      organizationId: organization.id,
    });
    const first = found.ok
      ? found.data.find((c) => c.phone.replace(/\D/g, '').endsWith(digits))
      : undefined;
    if (first) match = { id: first.id, name: first.name };
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Commande {order.number}
          </h1>
          <Badge tone={ORDER_STATUS_TONES[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          {order.late && <Badge tone="danger">En retard</Badge>}
        </div>
        <p className="text-lg">
          {order.customer ? (
            <Link
              href={`/espace/clients/${order.customer.id}`}
              className="font-bold underline underline-offset-4"
            >
              {order.customer.name}
            </Link>
          ) : (
            <span className="font-bold">{person.name || 'Client effacé'}</span>
          )}
          {person.phone ? ` · ${person.phone}` : ''}
          {order.source === 'storefront' && (
            <span className="text-ink-muted"> · envoyée de la vitrine</span>
          )}
        </p>
        <p className="text-ink-muted">
          Pour le {dueLabel(order)} ·{' '}
          {order.fulfilment === 'delivery'
            ? 'livraison'
            : 'retrait en boutique'}
        </p>
      </header>

      {order.status === 'delivered' && order.saleId && (
        <Alert tone="success">
          Remise le {formatDateTime(order.deliveredAt!, organization.timezone)}{' '}
          :{' '}
          <Link
            href={`/espace/ventes/${order.saleId}`}
            className="font-bold underline"
          >
            voir le ticket
          </Link>
          .
        </Alert>
      )}
      {order.cancellation && (
        <Alert tone="warning">
          Annulée le{' '}
          {formatDateTime(order.cancellation.at, organization.timezone)} :{' '}
          {order.cancellation.reason}
        </Alert>
      )}

      {toConfirm && canManage && (
        <Card title="À confirmer" titleId="order-confirm">
          <ConfirmActions
            organizationId={organization.id}
            order={order}
            currency={currency}
            shopName={organization.name}
            countryCode={organization.phoneCountryCode}
            match={match}
            canDecline={roleHasPermission(role, 'orders.cancel')}
          />
        </Card>
      )}

      {open && canManage && (
        <Card title="Où en est-elle ?" titleId="order-steps">
          <StatusSteps organizationId={organization.id} order={order} />
        </Card>
      )}

      <Card title="Articles" titleId="order-lines">
        <ul className="flex flex-col divide-y divide-line">
          {order.lines.map((line, index) => (
            <li key={index} className="flex flex-col gap-1 py-2 first:pt-0">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">
                  {line.label} × {String(line.quantity).replace('.', ',')}
                </span>
                <span className="font-bold tabular-nums">
                  {line.priceToSet ? 'Prix à donner' : money(line.lineTotal)}
                </span>
              </div>
              {line.note && <p className="text-ink-muted">{line.note}</p>}
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t border-dashed border-line-strong pt-3">
          {order.deliveryFee > 0 && (
            <>
              <Row label="Articles" value={money(order.itemsTotal)} />
              <Row label="Livraison" value={money(order.deliveryFee)} />
            </>
          )}
          <Row label="Total" value={money(order.total)} strong />
          <Row label="Déjà payé" value={money(order.paid)} />
          <Row label="Reste à payer" value={money(order.remaining)} strong />
        </dl>
      </Card>

      {order.fulfilment === 'delivery' && (
        <Card title="Livraison" titleId="order-delivery">
          <p>{order.deliveryAddress}</p>
          {order.deliveryLandmark && (
            <p className="text-ink-muted">Repère : {order.deliveryLandmark}</p>
          )}
          {order.deliveryPhone && (
            <p>Téléphone sur place : {order.deliveryPhone}</p>
          )}
        </Card>
      )}
      {order.note && (
        <Card title="Note" titleId="order-note">
          <p>{order.note}</p>
        </Card>
      )}

      {order.payments.length > 0 && (
        <Card title="Avances" titleId="order-payments">
          <ul className="flex flex-col gap-1">
            {order.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {p.kind === 'refund' ? 'Rendue' : 'Reçue'} ·{' '}
                  {PAYMENT_LABELS[p.method]}
                  {p.provider ? ` (${PROVIDER_LABELS[p.provider]})` : ''} ·{' '}
                  {formatDateTime(p.createdAt, organization.timezone)}
                </span>
                <span className="font-bold tabular-nums">
                  {p.kind === 'refund' ? '−' : ''}
                  {money(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <a
        href={whatsappLink(
          orderText(order, organization.name, money),
          person.phone,
          organization.phoneCountryCode,
        )}
        target="_blank"
        rel="noreferrer"
        className={`${buttonClasses('secondary')} self-start`}
      >
        <MessageCircle aria-hidden className="size-5" />
        Envoyer le bon sur WhatsApp
      </a>

      {open && canDeliver && (
        <Card title="Remettre au client" titleId="order-deliver">
          <DeliverForm
            organizationId={organization.id}
            order={order}
            currency={currency}
            canCredit={roleHasPermission(role, 'customers.manage')}
          />
        </Card>
      )}
      {open && canManage && order.remaining > 0 && (
        <Card title="Recevoir une avance" titleId="order-deposit">
          <DepositForm organizationId={organization.id} order={order} />
        </Card>
      )}
      {open && roleHasPermission(role, 'orders.cancel') && (
        <details className="rounded-3xl bg-surface p-4">
          <summary className="flex min-h-12 cursor-pointer items-center font-bold text-danger-ink">
            Annuler cette commande
          </summary>
          <div className="mt-3">
            <CancelForm
              organizationId={organization.id}
              order={order}
              currency={currency}
            />
          </div>
        </details>
      )}
    </>
  );
}

export default function OrderPage(props: Props) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Order {...props} />
    </Suspense>
  );
}
