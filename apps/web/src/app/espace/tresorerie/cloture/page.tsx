import {
  formatAmount,
  roleHasPermission,
  type ExpectedClosingDto,
  type TreasuryDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SelectField } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate } from '@/lib/format';
import { accountOptions } from '@/lib/treasury/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ClosingForm } from '../forms';

export const metadata: Metadata = {
  title: 'Clôturer la caisse — Nagaw Business',
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

async function Closing({
  searchParams,
}: PageProps<'/espace/tresorerie/cloture'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'treasury.manage'))
    return (
      <>
        <PageHeader title="Clôturer la caisse" />
        <Alert>Seuls le propriétaire et les gérants clôturent la caisse.</Alert>
      </>
    );
  const treasury = await apiAsUser<TreasuryDto>(accessToken, {
    path: '/treasury',
    organizationId: organization.id,
  });
  if (!treasury.ok)
    return (
      <>
        <PageHeader title="Clôturer la caisse" />
        <Alert tone="error">Trésorerie indisponible : {treasury.message}</Alert>
      </>
    );
  const params = await searchParams;
  const accounts = treasury.data.accounts;
  const account =
    accounts.find((a) => a.id === params.caisse) ??
    accounts.find((a) => a.kind === 'cash') ??
    accounts[0]!;
  const today = treasury.data.today.day;
  const day =
    typeof params.jour === 'string' &&
    DAY_RE.test(params.jour) &&
    params.jour <= today
      ? params.jour
      : today;
  const expected = await apiAsUser<ExpectedClosingDto>(accessToken, {
    path: `/treasury/closings/expected?${new URLSearchParams({ cashAccountId: account.id, day })}`,
    organizationId: organization.id,
  });
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);

  return (
    <>
      <PageHeader
        title="Clôturer la caisse"
        description="Comptez l’argent, l’application dit s’il manque quelque chose."
      />
      <form
        action="/espace/tresorerie/cloture"
        className="flex flex-wrap items-end gap-3"
      >
        <SelectField
          label="Caisse"
          name="caisse"
          id="closing-account"
          defaultValue={account.id}
          options={accountOptions(accounts)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closing-day" className="text-base font-semibold">
            Jour
          </label>
          <input
            id="closing-day"
            name="jour"
            type="date"
            defaultValue={day}
            max={today}
            className="min-h-12 rounded-xl border-2 border-line-strong bg-surface px-4 py-2 text-base text-ink"
          />
        </div>
        <button type="submit" className={buttonClasses('secondary')}>
          Changer
        </button>
      </form>

      {!expected.ok ? (
        <Alert tone="error">
          Montant attendu indisponible : {expected.message}
        </Alert>
      ) : (
        <Card
          title={`${account.name} — ${formatCalendarDate(day)}`}
          titleId="closing-card"
        >
          <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Entré ce jour" value={money(expected.data.moneyIn)} />
            <Stat label="Sorti ce jour" value={money(expected.data.moneyOut)} />
            <Stat
              label="Devrait y avoir"
              value={money(expected.data.expectedAmount)}
            />
          </dl>
          {expected.data.closing ? (
            <Alert
              tone={
                expected.data.closing.difference === 0 ? 'success' : 'warning'
              }
            >
              Journée clôturée par {expected.data.closing.closedBy.email} :{' '}
              {money(expected.data.closing.countedAmount)} comptés
              {expected.data.closing.difference === 0
                ? ', le compte était juste.'
                : expected.data.closing.difference < 0
                  ? `, il manquait ${money(-expected.data.closing.difference)}.`
                  : `, il y avait ${money(expected.data.closing.difference)} de trop.`}
            </Alert>
          ) : (
            <>
              <p className="mb-4 text-ink-muted">
                Envoyez d’abord les ventes faites sans connexion sur les
                téléphones : elles comptent dans ce qui devrait y avoir. Une
                fois clôturée, la journée ne change plus.
              </p>
              <ClosingForm
                organizationId={organization.id}
                accountId={account.id}
                day={day}
                expected={expected.data.expectedAmount}
                currency={organization.defaultCurrency}
              />
            </>
          )}
        </Card>
      )}
      <Link
        href={`/espace/tresorerie/${account.id}`}
        className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
      >
        Voir les entrées et sorties de {account.name}
      </Link>
    </>
  );
}

export default function ClosingPage(
  props: PageProps<'/espace/tresorerie/cloture'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Closing {...props} />
    </Suspense>
  );
}
