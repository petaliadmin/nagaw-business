import {
  formatAmount,
  historyLabel,
  PLAN_MODULE_LABELS,
  PLAN_MODULES,
  type AdminPlanDto,
  type PlanRevisionDto,
} from '@nagaw/shared';
import { Crown } from 'lucide-react';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatContact, formatDateTime } from '@/lib/format';
import { PLAN_LIMITS, planCount } from '@/lib/plans';
import { PlanForm } from '../forms';

/** What changed between two states of an offer, in a few words. */
function changes(r: PlanRevisionDto): string[] {
  const out: string[] = [];
  const money = (n: number) => formatAmount(n, 'XOF');
  if (r.before.monthlyPrice !== r.after.monthlyPrice)
    out.push(
      `prix du mois ${money(r.before.monthlyPrice)} → ${money(r.after.monthlyPrice)}`,
    );
  if (r.before.yearlyPrice !== r.after.yearlyPrice)
    out.push(
      `prix d’un an ${money(r.before.yearlyPrice)} → ${money(r.after.yearlyPrice)}`,
    );
  for (const l of PLAN_LIMITS) {
    const [a, b] = [r.before.limits[l.key], r.after.limits[l.key]];
    if (a !== b) out.push(`${planCount(a, l.unit)} → ${planCount(b, l.unit)}`);
  }
  if (r.before.limits.historyMonths !== r.after.limits.historyMonths)
    out.push(
      `historique ${historyLabel(r.before.limits.historyMonths)} → ${historyLabel(r.after.limits.historyMonths)}`,
    );
  for (const m of PLAN_MODULES) {
    const [a, b] = [
      r.before.limits.modules.includes(m),
      r.after.limits.modules.includes(m),
    ];
    if (a !== b)
      out.push(`${PLAN_MODULE_LABELS[m]} ${b ? 'ajouté' : 'retiré'}`);
  }
  return out.length > 0 ? out : ['aucun changement'];
}

/**
 * The offers (ADR-075): prices, limits and modules, changed here without a
 * deployment, and the last changes of each.
 */
async function Offers() {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const plans = await apiAsUser<AdminPlanDto[]>(admin.accessToken, {
    path: '/admin/plans',
  });
  return (
    <>
      <PageHeader
        title="Offres"
        description="Prix, limites et modules de chaque offre. Un changement s’applique tout de suite aux boutiques de l’offre ; rien de ce qu’elles ont déjà n’est supprimé."
      />
      {!plans.ok ? (
        <Alert tone="error">Offres indisponibles : {plans.message}</Alert>
      ) : (
        plans.data.map((plan) => (
          <Card
            key={plan.key}
            title={`Offre ${plan.name}`}
            titleId={`offre-${plan.key}`}
            icon={Crown}
          >
            <p className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                {plan.shops} boutique{plan.shops > 1 ? 's' : ''}
              </Badge>
            </p>
            <PlanForm plan={plan} />
            {plan.revisions.length > 0 && (
              <section
                aria-labelledby={`historique-${plan.key}`}
                className="mt-6 flex flex-col gap-2 border-t border-line pt-4"
              >
                <h3 id={`historique-${plan.key}`} className="text-lg font-bold">
                  Derniers changements
                </h3>
                <ul className="flex flex-col gap-2">
                  {plan.revisions.map((r) => (
                    <li key={r.id} className="flex flex-col">
                      <span className="font-semibold">
                        {formatDateTime(r.createdAt, 'UTC')} (UTC), par{' '}
                        {formatContact(r.changedBy)}
                      </span>
                      <span className="text-ink-muted">
                        {changes(r).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </Card>
        ))
      )}
    </>
  );
}

export default function OffersPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Offers />
    </Suspense>
  );
}
