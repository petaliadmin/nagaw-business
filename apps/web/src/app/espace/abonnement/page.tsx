import {
  formatAmount,
  historyLabel,
  paymentReference,
  USAGE_OF,
  SUBSCRIPTION_PERIOD_LABELS,
  type SubscriptionInvoiceDto,
  roleHasPermission,
  usagePercent,
  type PlanDto,
  type SubscriptionDto,
} from '@nagaw/shared';
import { Crown } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDate, formatDateTime } from '@/lib/format';
import { PlanFeatures } from '@/components/plans/plan-features';
import { PLAN_LIMITS, planPrice } from '@/lib/plans';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import {
  AutoRenewForm,
  CancelPlanRequestForm,
  RequestPlanForm,
} from './plan-forms';

export const metadata: Metadata = { title: 'Abonnement — Nagaw Business' };

const formatNumber = (n: number) => new Intl.NumberFormat('fr').format(n);

function Gauge({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  /** Null: no limit, so no gauge. */
  limit: number | null;
}) {
  if (limit === null)
    return (
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums">{formatNumber(used)} (sans limite)</span>
      </div>
    );
  const percent = usagePercent(used, limit);
  const full = used >= limit;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span
          className={`tabular-nums ${full ? 'font-bold text-warning-ink' : ''}`}
        >
          {formatNumber(used)} sur {formatNumber(limit)}
        </span>
      </div>
      <div
        aria-hidden
        className="h-3 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={`h-full rounded-full ${full ? 'bg-warning-strong' : 'bg-brand-strong'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {full && (
        <p className="text-warning-ink">
          Limite atteinte : rien de plus ne peut être ajouté.
        </p>
      )}
    </div>
  );
}

/** How to pay an offer by hand, until online payment exists (ADR-056). */
function PaymentSteps({ subscription: s }: { subscription: SubscriptionDto }) {
  const request = s.pendingRequest;
  if (!request) return null;
  const { wave, orangeMoney } = s.payment;
  if (request.plan.monthlyPrice === 0 || (!wave && !orangeMoney))
    return (
      <>
        L’équipe Nagaw traite la demande et vous contacte si besoin. L’offre
        change dès que c’est fait.
      </>
    );
  return (
    <span className="mt-2 flex flex-col gap-2">
      <span>
        Pour activer l’offre, envoyez{' '}
        <strong>
          {formatAmount(
            request.period === 'year'
              ? request.plan.yearlyPrice
              : request.plan.monthlyPrice,
            request.plan.currency,
          )}
        </strong>{' '}
        pour {SUBSCRIPTION_PERIOD_LABELS[request.period]} :
      </span>
      {wave && (
        <span>
          par Wave au <strong>{wave}</strong>
        </span>
      )}
      {orangeMoney && (
        <span>
          par Orange Money au <strong>{orangeMoney}</strong>
        </span>
      )}
      <span>
        Indiquez la référence <strong>{paymentReference(request.id)}</strong>.
        L’offre change dès que l’équipe a reçu le paiement.
      </span>
    </span>
  );
}

/** An invoice to pay: amount, before when, and how (ADR-073). */
function InvoiceToPay({
  invoice,
  payment,
  timeZone,
}: {
  invoice: SubscriptionInvoiceDto;
  payment: SubscriptionDto['payment'];
  timeZone: string;
}) {
  return (
    <Alert tone="warning">
      <span className="block font-bold">
        Facture à payer : {formatAmount(invoice.amount, invoice.currency)} pour{' '}
        {SUBSCRIPTION_PERIOD_LABELS[invoice.period]} ({invoice.plan.name}),
        avant le {formatDate(invoice.dueAt, timeZone)}.
      </span>
      <span className="mt-1 block">
        Sans paiement à cette date, la boutique sera suspendue jusqu’à ce que
        l’équipe Nagaw le reçoive.
      </span>
      {(payment.wave || payment.orangeMoney) && (
        <span className="mt-2 flex flex-col gap-1">
          {payment.wave && (
            <span>
              Par Wave au <strong>{payment.wave}</strong>
            </span>
          )}
          {payment.orangeMoney && (
            <span>
              Par Orange Money au <strong>{payment.orangeMoney}</strong>
            </span>
          )}
          <span>
            Indiquez la référence <strong>{invoice.reference}</strong>.
          </span>
        </span>
      )}
    </Alert>
  );
}

async function Subscription() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'subscription.read'))
    return (
      <>
        <PageHeader title="Abonnement" />
        <Alert>
          Seuls le propriétaire et les gérants voient l’abonnement de la
          boutique.
        </Alert>
      </>
    );
  const [subscription, plans] = await Promise.all([
    apiAsUser<SubscriptionDto>(accessToken, {
      path: '/subscription',
      organizationId: organization.id,
    }),
    apiAsUser<PlanDto[]>(accessToken, { path: '/plans' }),
  ]);
  if (!subscription.ok || !plans.ok)
    return (
      <>
        <PageHeader title="Abonnement" />
        <Alert tone="error">
          Abonnement indisponible :{' '}
          {!subscription.ok
            ? subscription.message
            : !plans.ok
              ? plans.message
              : ''}
        </Alert>
      </>
    );
  const s = subscription.data;
  const isOwner = roleHasPermission(organization.role, 'subscription.manage');

  return (
    <>
      <PageHeader
        title="Abonnement"
        description="L’offre de la boutique et ce qu’elle permet."
      />

      <Card title={`Offre ${s.plan.name}`} titleId="current-plan" icon={Crown}>
        <p className="text-lg font-bold">{planPrice(s.plan)}</p>
        <p className="mb-4 text-ink-muted">
          {s.lifetime
            ? 'Abonnement à vie, offert par Nagaw : rien à payer.'
            : s.currentPeriodEnd
              ? `${SUBSCRIPTION_PERIOD_LABELS[s.period]}, valable jusqu’au ${formatDate(s.currentPeriodEnd, organization.timezone)}. ${s.autoRenew ? 'Renouvelé automatiquement : une facture arrive à la fin de la période.' : 'Pas de renouvellement : la boutique repassera en Gratuit à cette date.'}`
              : 'Sans date de fin.'}
        </p>
        {s.lifetime && (
          <p className="mb-4">
            <Badge tone="success">À vie</Badge>
          </p>
        )}
        <div className="flex flex-col gap-4">
          {PLAN_LIMITS.filter((l) => l.always || s.limits[l.key] !== null).map(
            (l) => (
              <Gauge
                key={l.key}
                label={l.label}
                used={s.usage[USAGE_OF[l.key]]}
                limit={s.limits[l.key]}
              />
            ),
          )}
          {s.limits.historyMonths !== null && (
            <p>
              <span className="font-semibold">Historique affiché : </span>
              {historyLabel(s.limits.historyMonths)}. Rien n’est effacé : une
              autre offre montre tout.
            </p>
          )}
        </div>
      </Card>

      {s.invoices
        .filter((i) => i.status === 'pending')
        .map((invoice) => (
          <InvoiceToPay
            key={invoice.id}
            invoice={invoice}
            payment={s.payment}
            timeZone={organization.timezone}
          />
        ))}

      {isOwner && !s.lifetime && s.currentPeriodEnd && (
        <AutoRenewForm
          organizationId={organization.id}
          autoRenew={s.autoRenew}
        />
      )}

      {s.pendingRequest && (
        <Alert>
          <span className="block font-bold">
            Demande de passage à l’offre {s.pendingRequest.plan.name} envoyée le{' '}
            {formatDateTime(s.pendingRequest.createdAt, organization.timezone)}.
          </span>
          <PaymentSteps subscription={s} />
          {isOwner && (
            <span className="mt-3 block">
              <CancelPlanRequestForm organizationId={organization.id} />
            </span>
          )}
        </Alert>
      )}

      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <h2 id="plans-title" className="text-xl font-bold">
          Les offres
        </h2>
        <ul
          aria-labelledby="plans-title"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          {plans.data.map((plan) => {
            const current = plan.key === s.plan.key;
            return (
              <li
                key={plan.key}
                aria-label={`Offre ${plan.name}`}
                className={`flex flex-col gap-3 rounded-2xl border-2 bg-surface p-4 ${current ? 'border-brand-strong' : 'border-line'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-extrabold">{plan.name}</h3>
                  {current && <Badge tone="brand">Votre offre</Badge>}
                </div>
                <p className="text-2xl font-extrabold">{planPrice(plan)}</p>
                <PlanFeatures
                  limits={plan.limits}
                  grid={plans.data.map((p) => p.limits)}
                />
                {isOwner &&
                  !s.lifetime &&
                  !s.pendingRequest &&
                  (!current || plan.monthlyPrice > 0) && (
                    <div className="mt-auto">
                      <RequestPlanForm
                        organizationId={organization.id}
                        plan={plan}
                      />
                    </div>
                  )}
              </li>
            );
          })}
        </ul>
        {!isOwner && (
          <p className="text-ink-muted">
            Seul le propriétaire peut demander une autre offre.
          </p>
        )}
      </section>

      {s.invoices.some((i) => i.status !== 'pending') && (
        <Card title="Factures" titleId="invoices">
          <ul className="flex flex-col divide-y divide-line">
            {s.invoices
              .filter((i) => i.status !== 'pending')
              .map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap justify-between gap-2 py-2"
                >
                  <span>
                    {i.reference} · {i.plan.name},{' '}
                    {SUBSCRIPTION_PERIOD_LABELS[i.period]} du{' '}
                    {formatDate(i.periodStart, organization.timezone)}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatAmount(i.amount, i.currency)} ·{' '}
                    {i.status === 'paid' ? 'payée' : 'annulée'}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<PageFallback variant="detail" />}>
      <Subscription />
    </Suspense>
  );
}
