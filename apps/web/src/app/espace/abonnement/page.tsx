import {
  formatAmount,
  roleHasPermission,
  usagePercent,
  type PlanDto,
  type PlanLimits,
  type SubscriptionDto,
} from '@nagaw/shared';
import { Check, Crown } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CancelPlanRequestForm, RequestPlanForm } from './plan-forms';

export const metadata: Metadata = { title: 'Abonnement — Nagaw Business' };

const LIMITS: {
  key: keyof PlanLimits;
  label: string;
  unit: [string, string];
}[] = [
  { key: 'products', label: 'Produits', unit: ['produit', 'produits'] },
  {
    key: 'members',
    label: 'Personnes dans l’équipe',
    unit: ['personne', 'personnes'],
  },
  {
    key: 'devices',
    label: 'Téléphones de caisse',
    unit: ['téléphone', 'téléphones'],
  },
];

const formatNumber = (n: number) => new Intl.NumberFormat('fr').format(n);
/** « 3 produits », or « Produits sans limite » (ADR-033). */
const count = (n: number | null, [one, many]: [string, string]) =>
  n === null
    ? `${many.charAt(0).toUpperCase()}${many.slice(1)} sans limite`
    : `${formatNumber(n)} ${n > 1 ? many : one}`;

function price(plan: PlanDto): string {
  return plan.monthlyPrice === 0
    ? 'Gratuit'
    : `${formatAmount(plan.monthlyPrice, plan.currency)} par mois`;
}

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
        <p className="mb-4 text-lg font-bold">{price(s.plan)}</p>
        <div className="flex flex-col gap-4">
          {LIMITS.map((l) => (
            <Gauge
              key={l.key}
              label={l.label}
              used={s.usage[l.key]}
              limit={s.limits[l.key]}
            />
          ))}
        </div>
      </Card>

      {s.pendingRequest && (
        <Alert>
          <span className="block font-bold">
            Demande de passage à l’offre {s.pendingRequest.plan.name} envoyée le{' '}
            {formatDateTime(s.pendingRequest.createdAt, organization.timezone)}.
          </span>
          Le paiement en ligne n’est pas encore ouvert : l’équipe Nagaw traite
          la demande et vous contacte pour le règlement. L’offre change dès que
          c’est fait.
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
                <p className="text-2xl font-extrabold">{price(plan)}</p>
                <ul className="flex flex-col gap-1">
                  {LIMITS.map((l) => (
                    <li key={l.key} className="flex items-center gap-2">
                      <Check aria-hidden className="size-5 text-sales-ink" />
                      {count(plan.limits[l.key], l.unit)}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <Check aria-hidden className="size-5 text-sales-ink" />
                    Ventes, factures, trésorerie, comptabilité
                  </li>
                </ul>
                {isOwner && !current && !s.pendingRequest && (
                  <div className="mt-auto">
                    <RequestPlanForm
                      organizationId={organization.id}
                      planKey={plan.key}
                      planName={plan.name}
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
    </>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Subscription />
    </Suspense>
  );
}
