import {
  courierText,
  formatAmount,
  isToRemind,
  orderReminderText,
  roleHasPermission,
  type OrderDto,
} from '@nagaw/shared';
import { MessageCircle, Phone, Receipt, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/orders/labels';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';
import { whatsappLink } from '@/lib/sales/ticket';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  CancelOrder,
  CheckWavePayment,
  ConfirmOrder,
  DeliverOrder,
  PayOrder,
  ShipOrder,
} from './order-actions';

export const metadata: Metadata = { title: 'Commande — Nagaw Business' };

async function Order({ params }: PageProps<'/espace/commandes/[id]'>) {
  const { id } = await params;
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const result = await apiAsUser<OrderDto>(accessToken, {
    path: `/orders/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!result.ok)
    return (
      <Alert tone="error">
        {result.status === 404
          ? 'Commande introuvable.'
          : `Commande indisponible : ${result.message}`}
      </Alert>
    );
  const order = result.data;
  const money = (amount: number) => formatAmount(amount, order.currency);
  const canManage = roleHasPermission(organization.role, 'orders.manage');
  const canSell = roleHasPermission(organization.role, 'sales.create');
  const open = order.status !== 'delivered' && order.status !== 'cancelled';
  const props = {
    organizationId: organization.id,
    order,
    currency: order.currency,
  };
  const code = organization.phoneCountryCode;

  return (
    <>
      <PageHeader
        title={`Commande ${order.reference}`}
        description={`Reçue le ${formatDateTime(order.createdAt, organization.timezone)}`}
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={ORDER_STATUS_TONES[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
        {order.paidAt ? (
          <Badge tone="success">Payée</Badge>
        ) : open ? (
          <Badge tone="warning">Pas payée</Badge>
        ) : null}
      </div>

      {canManage && open && (
        <Card title="Prochaine étape" titleId="next-step">
          <div className="flex flex-col gap-4">
            {order.status === 'new' && <ConfirmOrder {...props} />}
            {order.status === 'confirmed' && <ShipOrder {...props} />}
            {order.status === 'shipping' && canSell && (
              <DeliverOrder {...props} primary />
            )}
            {order.status === 'confirmed' && canSell && (
              <details className="rounded-2xl border border-line p-4">
                <summary className="flex min-h-12 cursor-pointer items-center text-base font-bold">
                  Remise en main propre, sans livreur
                </summary>
                <div className="mt-4">
                  <DeliverOrder {...props} primary={false} />
                </div>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              {isToRemind(order) && (
                <a
                  href={whatsappLink(
                    orderReminderText(order, organization.name),
                    order.customerPhone,
                    code,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses('secondary')}
                >
                  <MessageCircle aria-hidden className="size-5" />
                  Relancer sur WhatsApp
                </a>
              )}
              {order.status === 'shipping' && order.courierPhone && (
                <a
                  href={whatsappLink(
                    courierText(order),
                    order.courierPhone,
                    code,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses('secondary')}
                >
                  <Truck aria-hidden className="size-5" />
                  Message au livreur
                </a>
              )}
              {!order.paidAt && order.waveSessionId && (
                <CheckWavePayment {...props} />
              )}
              {!order.paidAt && order.status !== 'new' && (
                <PayOrder {...props} />
              )}
              <CancelOrder {...props} />
            </div>
          </div>
        </Card>
      )}

      {order.status === 'delivered' && order.saleId && (
        <Alert tone="success">
          Livrée le{' '}
          {order.deliveredAt &&
            formatDateTime(order.deliveredAt, organization.timezone)}
          . La vente est enregistrée.{' '}
          <Link
            href={`/espace/ventes/${order.saleId}`}
            className="font-bold underline underline-offset-4"
          >
            Voir la vente
          </Link>
        </Alert>
      )}
      {order.status === 'cancelled' && (
        <Alert>Annulée : {order.cancelReason}</Alert>
      )}

      <Card title="Client" titleId="customer" icon={Phone}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat label="Nom" value={order.customerName} />
          <Stat label="Téléphone" value={`+${order.customerPhone}`} />
          <Stat label="Livraison" value={order.customerArea} />
          {order.customerNote && (
            <Stat label="Son mot" value={order.customerNote} />
          )}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`tel:+${order.customerPhone}`}
            className={buttonClasses('secondary')}
          >
            <Phone aria-hidden className="size-5" />
            Appeler
          </a>
          <a
            href={whatsappLink(
              `Bonjour ${order.customerName}, c’est ${organization.name}, pour votre commande ${order.reference}.`,
              order.customerPhone,
              code,
            )}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses('secondary')}
          >
            <MessageCircle aria-hidden className="size-5" />
            Écrire sur WhatsApp
          </a>
        </div>
      </Card>

      <Card title="Articles" titleId="lines" icon={Receipt}>
        <ul className="flex flex-col gap-2 text-base">
          {order.lines.map((line) => (
            <li key={line.position} className="flex justify-between gap-3">
              <span>
                {line.quantity} × {line.label}
              </span>
              <span className="font-semibold tabular-nums">
                {money(line.lineTotal)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-line pt-2 text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(order.total)}</span>
          </li>
        </ul>
        {order.payment && (
          <p className="mt-3 text-base">
            Payée :{' '}
            {order.payment.provider
              ? PROVIDER_LABELS[order.payment.provider]
              : PAYMENT_LABELS[order.payment.method]}
            {order.payment.reference && ` · ${order.payment.reference}`}
          </p>
        )}
        {(order.courierName || order.deliveryFee > 0) && (
          <p className="mt-1 text-base text-ink-muted">
            Livreur : {order.courierName || '—'}
            {order.deliveryFee > 0 &&
              ` · livraison ${money(order.deliveryFee)}, payée au livreur`}
          </p>
        )}
      </Card>
    </>
  );
}

export default function OrderPage(props: PageProps<'/espace/commandes/[id]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Order {...props} />
    </Suspense>
  );
}
