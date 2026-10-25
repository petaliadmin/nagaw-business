import {
  formatAmount,
  roleHasPermission,
  type JournalDto,
  type StatementDto,
} from '@nagaw/shared';
import { BookOpen, Download, Landmark, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PeriodPicker } from '@/components/treasury/period-picker';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card, Stat } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatCalendarDate, todayIn } from '@/lib/format';
import { resolvePeriod } from '@/lib/treasury/period';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ScrollRegion } from '@/components/ui/scroll-region';

export const metadata: Metadata = { title: 'Comptabilité — Nagaw Business' };

type Workspace = NonNullable<Awaited<ReturnType<typeof requireReadyWorkspace>>>;

function Lines({
  title,
  lines,
  total,
  money,
}: {
  title: string;
  lines: { code: string; label: string; amount: number }[];
  total: number;
  money: (value: number) => string;
}) {
  return (
    <table className="w-full text-left">
      <caption className="mb-2 text-left text-lg font-bold">{title}</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="py-2 pr-3">
            Compte
          </th>
          <th scope="col" className="py-2 text-right">
            Montant
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 ? (
          <tr>
            <td colSpan={2} className="py-2 text-ink-muted">
              Rien sur la période.
            </td>
          </tr>
        ) : (
          lines.map((line) => (
            <tr key={line.code} className="border-b border-line">
              <th scope="row" className="py-2 pr-3 font-normal">
                <span className="font-semibold">{line.code}</span> {line.label}
              </th>
              <td className="py-2 text-right tabular-nums">
                {money(line.amount)}
              </td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="py-2 pr-3">
            Total
          </th>
          <td className="py-2 text-right font-bold tabular-nums">
            {money(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

async function Journal({
  workspace,
  params,
}: {
  workspace: Workspace;
  params: Record<string, string | string[] | undefined>;
}) {
  const { organization, accessToken } = workspace;
  const period = resolvePeriod(params, todayIn(organization.timezone), 'mois');
  const query = new URLSearchParams({ from: period.from, to: period.to });
  const journal = await apiAsUser<JournalDto>(accessToken, {
    path: `/accounting/journal?${query}`,
    organizationId: organization.id,
  });
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  return (
    <>
      <PeriodPicker
        path="/espace/comptabilite"
        current={period.key}
        from={period.from}
        to={period.to}
        extra={{ vue: 'journal' }}
      />
      <a
        href={`/espace/comptabilite/export/journal?${query}`}
        className={buttonClasses('secondary', 'self-start')}
      >
        <Download aria-hidden className="size-5" />
        Télécharger le journal (CSV)
      </a>
      {!journal.ok ? (
        <Alert tone="error">Journal indisponible : {journal.message}</Alert>
      ) : (
        <Card
          title="Journal des recettes et dépenses"
          titleId="journal"
          icon={BookOpen}
        >
          <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat
              label="Recettes"
              value={money(journal.data.totals.receipts)}
            />
            <Stat
              label="Dépenses"
              value={money(journal.data.totals.expenses)}
            />
          </dl>
          {journal.data.truncated && (
            <Alert>
              Les 5 000 premières lignes sont affichées : le fichier CSV
              contient tout.
            </Alert>
          )}
          {journal.data.entries.length === 0 ? (
            <EmptyState title="Aucune recette ni dépense sur cette période" />
          ) : (
            <ul
              aria-labelledby="journal"
              className="flex flex-col divide-y divide-line"
            >
              {journal.data.entries.map((e, index) => (
                <li
                  key={index}
                  className="flex flex-wrap justify-between gap-3 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{e.label}</span>
                    <span className="text-ink-muted">
                      {formatCalendarDate(e.day)}
                      {e.voucher ? ` · ${e.voucher}` : ''} · compte{' '}
                      {e.account.code} · {e.cashAccount.name} (
                      {e.cashAccount.code})
                    </span>
                  </span>
                  <span
                    className={`font-bold tabular-nums ${e.expense > 0 ? 'text-danger-ink' : 'text-sales-ink'}`}
                  >
                    {e.receipt > 0
                      ? `+${money(e.receipt)}`
                      : `−${money(e.expense)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

async function Statement({
  workspace,
  params,
}: {
  workspace: Workspace;
  params: Record<string, string | string[] | undefined>;
}) {
  const { organization, accessToken } = workspace;
  const current = Number(todayIn(organization.timezone).slice(0, 4));
  const asked =
    typeof params.annee === 'string' ? Number(params.annee) : current;
  const year =
    Number.isInteger(asked) && asked >= 2000 && asked <= current
      ? asked
      : current;
  const statement = await apiAsUser<StatementDto>(accessToken, {
    path: `/accounting/statement?year=${year}`,
    organizationId: organization.id,
  });
  const money = (value: number) =>
    formatAmount(value, organization.defaultCurrency);
  return (
    <>
      <nav aria-label="Exercice" className="flex flex-wrap gap-2">
        {[current, current - 1, current - 2].map((y) => (
          <Link
            key={y}
            href={`/espace/comptabilite?vue=etat&annee=${y}`}
            aria-current={y === year ? 'true' : undefined}
            className={buttonClasses(y === year ? 'primary' : 'secondary')}
          >
            {y}
          </Link>
        ))}
      </nav>
      <a
        href={`/espace/comptabilite/export/etat?year=${year}`}
        className={buttonClasses('secondary', 'self-start')}
      >
        <Download aria-hidden className="size-5" />
        Télécharger l’état (CSV)
      </a>
      {!statement.ok ? (
        <Alert tone="error">État indisponible : {statement.message}</Alert>
      ) : (
        <>
          {statement.data.provisional && (
            <Alert>
              Exercice {year} en cours : chiffres provisoires, arrêtés au{' '}
              {formatCalendarDate(statement.data.to)}.
            </Alert>
          )}
          <Card title={`Résultat ${year}`} titleId="result" icon={Scale}>
            <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Recettes"
                value={money(statement.data.totals.receipts)}
              />
              <Stat
                label="Dépenses"
                value={money(statement.data.totals.expenses)}
              />
              <Stat
                label="Résultat"
                value={money(statement.data.totals.result)}
              />
            </dl>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Lines
                title="Recettes"
                lines={statement.data.receipts}
                total={statement.data.totals.receipts}
                money={money}
              />
              <Lines
                title="Dépenses"
                lines={statement.data.expenses}
                total={statement.data.totals.expenses}
                money={money}
              />
            </div>
          </Card>
          <Card title="Trésorerie et biens" titleId="balance" icon={Landmark}>
            <ScrollRegion label="Trésorerie au début et à la fin de l’exercice">
              <table className="w-full text-left">
                <caption className="sr-only">
                  Trésorerie au début et à la fin de l’exercice
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3">
                      Caisse
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right">
                      Au début
                    </th>
                    <th scope="col" className="py-2 text-right">
                      À la fin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statement.data.treasury.accounts
                    .filter((a) => a.start !== 0 || a.end !== 0)
                    .map((a) => (
                      <tr key={a.id} className="border-b border-line">
                        <th scope="row" className="py-2 pr-3 font-normal">
                          <span className="font-semibold">{a.code}</span>{' '}
                          {a.name}
                        </th>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {money(a.start)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {money(a.end)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="py-2 pr-3">
                      Total
                    </th>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">
                      {money(statement.data.treasury.start)}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums">
                      {money(statement.data.treasury.end)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </ScrollRegion>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Crédit des clients"
                value={money(statement.data.receivables.customers)}
              />
              <Stat
                label="Factures à encaisser"
                value={money(statement.data.receivables.invoices)}
              />
              <Stat
                label="Stock (prix d’achat)"
                value={money(statement.data.stock.value)}
              />
            </dl>
            {statement.data.stock.unvaluedProducts > 0 && (
              <p className="mt-3 text-ink-muted">
                {statement.data.stock.unvaluedProducts} produit(s) en stock sans
                prix d’achat ne sont pas comptés dans la valeur du stock.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}

async function Accounting({ searchParams }: PageProps<'/espace/comptabilite'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  if (!roleHasPermission(workspace.organization.role, 'accounting.read'))
    return (
      <>
        <PageHeader title="Comptabilité" />
        <Alert>
          Votre rôle ne donne pas accès à la comptabilité de la boutique.
        </Alert>
      </>
    );
  const params = await searchParams;
  const statement = params.vue === 'etat';
  return (
    <>
      <PageHeader
        title="Comptabilité"
        description="Système minimal de trésorerie (SYSCOHADA) : tenu tout seul à partir de vos ventes, paiements et dépenses."
      />
      <nav aria-label="Document comptable" className="flex flex-wrap gap-2">
        <Link
          href="/espace/comptabilite"
          aria-current={!statement ? 'true' : undefined}
          className={buttonClasses(!statement ? 'primary' : 'secondary')}
        >
          Journal
        </Link>
        <Link
          href="/espace/comptabilite?vue=etat"
          aria-current={statement ? 'true' : undefined}
          className={buttonClasses(statement ? 'primary' : 'secondary')}
        >
          État de fin d’exercice
        </Link>
      </nav>
      {statement ? (
        <Statement workspace={workspace} params={params} />
      ) : (
        <Journal workspace={workspace} params={params} />
      )}
    </>
  );
}

export default function AccountingPage(
  props: PageProps<'/espace/comptabilite'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Accounting {...props} />
    </Suspense>
  );
}
