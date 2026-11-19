import {
  roleHasPermission,
  type ExpectedClosingDto,
  type TreasuryDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, formatContact } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ClosingsForm, type ClosingRow } from '../forms';

export const metadata: Metadata = {
  title: 'Clôturer la journée — Nagaw Business',
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
        <PageHeader title="Clôturer la journée" />
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
        <PageHeader title="Clôturer la journée" />
        <Alert tone="error">Trésorerie indisponible : {treasury.message}</Alert>
      </>
    );
  const params = await searchParams;
  const accounts = treasury.data.accounts;
  const today = treasury.data.today.day;
  const day =
    typeof params.jour === 'string' &&
    DAY_RE.test(params.jour) &&
    params.jour <= today
      ? params.jour
      : today;
  const expected = await Promise.all(
    accounts.map((account) =>
      apiAsUser<ExpectedClosingDto>(accessToken, {
        path: `/treasury/closings/expected?${new URLSearchParams({ cashAccountId: account.id, day })}`,
        organizationId: organization.id,
      }),
    ),
  );
  const failed = expected.find((r) => !r.ok);
  const rows: ClosingRow[] = accounts.flatMap((account, index) => {
    const result = expected[index];
    if (!result?.ok) return [];
    const closing = result.data.closing;
    return [
      {
        id: account.id,
        name: account.name,
        look: { kind: account.kind, provider: account.provider },
        expected: result.data.expectedAmount,
        closed: closing
          ? {
              counted: closing.countedAmount,
              difference: closing.difference,
              by: formatContact(closing.closedBy.email),
            }
          : null,
      },
    ];
  });

  return (
    <>
      <PageHeader
        title="Clôturer la journée"
        description="Comptez l’argent de chaque compte et tapez ce que vous trouvez."
      />
      <details className="self-start" open={day !== today}>
        <summary className="inline-flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-full bg-surface px-4 font-bold">
          <CalendarDays aria-hidden className="size-5" />
          {day === today ? 'Aujourd’hui' : formatCalendarDate(day)} · Autre jour
        </summary>
        <form
          action="/espace/tresorerie/cloture"
          className="mt-3 flex flex-wrap items-end gap-3"
        >
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
              className="min-h-12 rounded-2xl border-2 border-line-strong bg-canvas px-4 py-2 text-base text-ink"
            />
          </div>
          <button type="submit" className={buttonClasses('secondary')}>
            Changer
          </button>
        </form>
      </details>
      {failed && !failed.ok && (
        <Alert tone="error">
          Montant attendu indisponible : {failed.message}
        </Alert>
      )}
      {rows.length > 0 && (
        <ClosingsForm
          key={day}
          organizationId={organization.id}
          day={day}
          rows={rows}
          currency={organization.defaultCurrency}
        />
      )}
      <ul className="flex flex-col">
        {accounts.map((account) => (
          <li key={account.id}>
            <Link
              href={`/espace/tresorerie/${account.id}`}
              className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
            >
              Voir les entrées et sorties de {account.name}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ClosingPage(
  props: PageProps<'/espace/tresorerie/cloture'>,
) {
  return (
    <Suspense fallback={<PageFallback variant="form" />}>
      <Closing {...props} />
    </Suspense>
  );
}
