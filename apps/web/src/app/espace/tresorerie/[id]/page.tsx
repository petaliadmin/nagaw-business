import {
  formatAmount,
  roleHasPermission,
  type CashMovementsDto,
  type ClosingDto,
} from '@nagaw/shared';
import { Calculator, Settings } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PeriodPicker } from '@/components/treasury/period-picker';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, todayIn } from '@/lib/format';
import { movementLabel } from '@/lib/treasury/labels';
import { resolvePeriod } from '@/lib/treasury/period';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { AccountForm } from '../forms';

export const metadata: Metadata = { title: 'Caisse — Nagaw Business' };

async function Account({
  params,
  searchParams,
}: PageProps<'/espace/tresorerie/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const period = resolvePeriod(
    await searchParams,
    todayIn(organization.timezone),
    'mois',
  );
  const query = new URLSearchParams({
    accountId: id,
    from: period.from,
    to: period.to,
  });
  const [statement, closings] = await Promise.all([
    apiAsUser<CashMovementsDto>(accessToken, {
      path: `/treasury/movements?${query}`,
      organizationId: organization.id,
    }),
    apiAsUser<ClosingDto[]>(accessToken, {
      path: `/treasury/closings?accountId=${encodeURIComponent(id)}`,
      organizationId: organization.id,
    }),
  ]);
  if (!statement.ok && statement.status === 404) notFound();
  if (!statement.ok)
    return (
      <Alert tone="error">Caisse indisponible : {statement.message}</Alert>
    );
  const s = statement.data;
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  const canManage = roleHasPermission(organization.role, 'treasury.manage');

  return (
    <>
      <PageHeader
        title={s.account.name}
        description={`Solde actuel : ${money(s.account.balance)}`}
        actions={
          canManage && (
            <ButtonLink
              href={`/espace/tresorerie/cloture?caisse=${s.account.id}`}
            >
              <Calculator aria-hidden className="size-5" />
              Clôturer
            </ButtonLink>
          )
        }
      />
      <PeriodPicker
        path={`/espace/tresorerie/${s.account.id}`}
        current={period.key}
        from={period.from}
        to={period.to}
      />
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          label={`Au début (${formatCalendarDate(s.from)})`}
          value={money(s.startBalance)}
        />
        <Stat
          label={`À la fin (${formatCalendarDate(s.to)})`}
          value={money(s.endBalance)}
        />
      </dl>

      <section
        aria-labelledby="movements-title"
        className="flex flex-col gap-3"
      >
        <h2 id="movements-title" className="text-xl font-bold">
          Entrées et sorties
        </h2>
        {s.movements.length === 0 ? (
          <EmptyState title="Rien sur cette période" />
        ) : (
          <ul
            aria-labelledby="movements-title"
            className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface px-4"
          >
            {s.movements.map((m, index) => (
              <li
                key={`${m.kind}-${m.sourceId}-${index}`}
                className="flex justify-between gap-3 py-3"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {movementLabel(m.kind, m.label)}
                  </span>
                  <span className="text-ink-muted">
                    {formatCalendarDate(m.day)}
                  </span>
                </span>
                <span
                  className={`font-bold tabular-nums ${m.amount < 0 ? 'text-danger-ink' : 'text-sales-ink'}`}
                >
                  {m.amount > 0 ? '+' : '−'}
                  {money(Math.abs(m.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card title="Clôtures" titleId="closings" icon={Calculator}>
        {!closings.ok ? (
          <Alert tone="error">
            Clôtures indisponibles : {closings.message}
          </Alert>
        ) : closings.data.length === 0 ? (
          <p className="text-ink-muted">
            Cette caisse n’a pas encore été clôturée.
          </p>
        ) : (
          <ul
            aria-labelledby="closings"
            className="flex flex-col divide-y divide-line"
          >
            {closings.data.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap justify-between gap-3 py-3 first:pt-0"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {formatCalendarDate(c.day)}
                  </span>
                  <span className="text-ink-muted">
                    Compté {money(c.countedAmount)} par {c.closedBy.email}
                    {c.note ? ` · ${c.note}` : ''}
                  </span>
                </span>
                <span
                  className={`font-bold ${c.difference < 0 ? 'text-danger-ink' : ''}`}
                >
                  {c.difference === 0
                    ? 'Juste'
                    : c.difference < 0
                      ? `Manque ${money(-c.difference)}`
                      : `Surplus ${money(c.difference)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && (
        <Card
          title="Réglages de la caisse"
          titleId="account-settings"
          icon={Settings}
        >
          {s.lastClosingDay && (
            <p className="mb-4 text-ink-muted">
              Clôturée le {formatCalendarDate(s.lastClosingDay)} : l’argent de
              départ ne change plus.
            </p>
          )}
          <AccountForm
            organizationId={organization.id}
            account={s.account}
            currency={organization.defaultCurrency}
            counted={s.lastClosingDay !== null}
          />
        </Card>
      )}
    </>
  );
}

export default function AccountPage(
  props: PageProps<'/espace/tresorerie/[id]'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Account {...props} />
    </Suspense>
  );
}
