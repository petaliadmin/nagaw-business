import { HttpStatus } from '@nestjs/common';
import {
  historyStart,
  type PlanLimits,
  type PlanModule,
  type PlanUsage,
} from '@nagaw/shared';
import { sql } from 'kysely';
import { toNumber, type Executor } from '../catalog/catalog.errors.js';
import { ApiException } from '../common/api-exception.js';

/**
 * Limits of a shop's offer (ADR-029, ADR-075). Products, people and cash
 * phones are the shop's caps, copied from the offer by the database; the
 * others are read from the offer itself, through the subscription.
 */
export async function planLimitsOf(
  executor: Executor,
  organizationId: string,
): Promise<PlanLimits> {
  const row = await executor
    .selectFrom('app.organizations as o')
    .innerJoin('app.subscriptions as s', 's.organization_id', 'o.id')
    .innerJoin('app.plans as p', 'p.key', 's.plan_key')
    .select([
      'o.max_products',
      'o.max_members',
      'o.max_devices',
      'p.max_sales_per_month',
      'p.max_invoices_per_month',
      'p.max_quotes_per_month',
      'p.max_customers',
      'p.max_suppliers',
      'p.history_months',
      'p.modules',
    ])
    .where('o.id', '=', organizationId)
    .executeTakeFirstOrThrow();
  return {
    products: row.max_products,
    members: row.max_members,
    devices: row.max_devices,
    salesPerMonth: row.max_sales_per_month,
    invoicesPerMonth: row.max_invoices_per_month,
    quotesPerMonth: row.max_quotes_per_month,
    customers: row.max_customers,
    suppliers: row.max_suppliers,
    historyMonths: row.history_months,
    modules: row.modules,
  };
}

/** The modules of a shop's offer, and its history. */
export async function planAccessOf(
  executor: Executor,
  organizationId: string,
): Promise<{ modules: PlanModule[]; historyMonths: number | null }> {
  const row = await executor
    .selectFrom('app.subscriptions as s')
    .innerJoin('app.plans as p', 'p.key', 's.plan_key')
    .select(['p.modules', 'p.history_months'])
    .where('s.organization_id', '=', organizationId)
    .executeTakeFirstOrThrow();
  return { modules: row.modules, historyMonths: row.history_months };
}

/** Start of the shop's calendar month, in its time zone. */
const monthStart = (organizationId: string) => sql<Date>`(
  select date_trunc('month', now() at time zone o.timezone) at time zone o.timezone
    from app.organizations o where o.id = ${organizationId})`;

type MonthlyKind = 'sales' | 'invoices' | 'quotes';

/**
 * What the shop made this month: sales not cancelled, invoices and quotes
 * created (drafts and cancelled ones too: each took a number or a slot).
 */
async function countThisMonth(
  executor: Executor,
  organizationId: string,
  kind: MonthlyKind,
): Promise<number> {
  const since = monthStart(organizationId);
  const query =
    kind === 'sales'
      ? executor
          .selectFrom('app.sales')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('organization_id', '=', organizationId)
          .where('status', '<>', 'cancelled')
          .where('occurred_at', '>=', since)
      : kind === 'invoices'
        ? executor
            .selectFrom('app.invoices')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .where('organization_id', '=', organizationId)
            // A credit note is never refused: it cancels an invoice.
            .where('kind', '=', 'invoice')
            .where('created_at', '>=', since)
        : executor
            .selectFrom('app.quotes')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .where('organization_id', '=', organizationId)
            .where('created_at', '>=', since);
  return toNumber((await query.executeTakeFirstOrThrow()).count);
}

async function countActive(
  executor: Executor,
  organizationId: string,
  table: 'app.customers' | 'app.suppliers',
): Promise<number> {
  const { count } = await executor
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('organization_id', '=', organizationId)
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  return toNumber(count);
}

/** What ADR-075 counts, besides products, people and phones. */
export async function planUsageExtra(
  executor: Executor,
  organizationId: string,
): Promise<Omit<PlanUsage, 'products' | 'members' | 'devices'>> {
  const [
    salesThisMonth,
    invoicesThisMonth,
    quotesThisMonth,
    customers,
    suppliers,
  ] = await Promise.all([
    countThisMonth(executor, organizationId, 'sales'),
    countThisMonth(executor, organizationId, 'invoices'),
    countThisMonth(executor, organizationId, 'quotes'),
    countActive(executor, organizationId, 'app.customers'),
    countActive(executor, organizationId, 'app.suppliers'),
  ]);
  return {
    salesThisMonth,
    invoicesThisMonth,
    quotesThisMonth,
    customers,
    suppliers,
  };
}

const ROOM = {
  customers: { label: 'clients', perMonth: false },
  suppliers: { label: 'fournisseurs', perMonth: false },
  invoicesPerMonth: { label: 'factures par mois', perMonth: true },
  quotesPerMonth: { label: 'devis par mois', perMonth: true },
} as const;

export type PlanRoom = keyof typeof ROOM;

export function planLimitReached(kind: PlanRoom, max: number): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'PLAN_LIMIT_REACHED',
    `Votre offre permet ${max} ${ROOM[kind].label}. Changez d’offre dans « Abonnement » pour en ajouter${
      ROOM[kind].perMonth ? ', ou attendez le mois prochain' : ''
    }.`,
  );
}

/**
 * Refuses one more customer, supplier, invoice or quote beyond the offer
 * (ADR-075). The caller holds the organization row locked, so that two
 * creations at once cannot both pass.
 */
export async function assertPlanRoom(
  trx: Executor,
  organizationId: string,
  kind: PlanRoom,
): Promise<void> {
  const limits = await planLimitsOf(trx, organizationId);
  const max = limits[kind];
  if (max === null) return;
  const used =
    kind === 'customers'
      ? await countActive(trx, organizationId, 'app.customers')
      : kind === 'suppliers'
        ? await countActive(trx, organizationId, 'app.suppliers')
        : await countThisMonth(
            trx,
            organizationId,
            kind === 'invoicesPerMonth' ? 'invoices' : 'quotes',
          );
  if (used >= max) throw planLimitReached(kind, max);
}

/**
 * First day the shop's offer shows, `YYYY-MM-DD` in its time zone; null:
 * all of the history (ADR-075). Nothing older is removed, only not listed.
 */
export async function historyFrom(
  executor: Executor,
  organizationId: string,
): Promise<string | null> {
  const row = await executor
    .selectFrom('app.organizations as o')
    .innerJoin('app.subscriptions as s', 's.organization_id', 'o.id')
    .innerJoin('app.plans as p', 'p.key', 's.plan_key')
    .select([
      'p.history_months',
      sql<string>`to_char(now() at time zone o.timezone, 'YYYY-MM-DD')`.as(
        'today',
      ),
    ])
    .where('o.id', '=', organizationId)
    .executeTakeFirstOrThrow();
  return historyStart(row.today, row.history_months);
}

/** The later of two days, `YYYY-MM-DD`; a missing one does not count. */
export function laterDay(
  a: string | null | undefined,
  b: string | null | undefined,
): string | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  return a > b ? a : b;
}

/** Without « Rapports et statistiques », the figures of the last 3 months. */
export const REPORTS_MONTHS_WITHOUT_MODULE = 3;

/**
 * First day the shop's figures may cover (ADR-075): its offer's history,
 * and at most the last 3 months without « Rapports et statistiques » (the
 * home page's periods and their comparison); null: no floor.
 */
export async function reportsFrom(
  executor: Executor,
  organizationId: string,
  today: string,
): Promise<{ from: string | null; statistics: boolean }> {
  const { modules, historyMonths } = await planAccessOf(
    executor,
    organizationId,
  );
  const statistics = modules.includes('statistics');
  const history = historyStart(today, historyMonths);
  return {
    from: statistics
      ? history
      : (laterDay(
          history,
          historyStart(today, REPORTS_MONTHS_WITHOUT_MODULE),
        ) ?? null),
    statistics,
  };
}

/** A period that ends before what the offer shows (ADR-075). */
export function outsideHistory(statistics: boolean): ApiException {
  return new ApiException(
    HttpStatus.FORBIDDEN,
    statistics ? 'HISTORY_NOT_IN_PLAN' : 'MODULE_NOT_IN_PLAN',
    statistics
      ? 'L’offre de la boutique ne montre pas cette période. Changez d’offre dans « Abonnement » pour voir tout l’historique.'
      : `Sans « Rapports et statistiques », l’offre montre les ${REPORTS_MONTHS_WITHOUT_MODULE} derniers mois. Changez d’offre dans « Abonnement ».`,
  );
}

/**
 * `column` (a moment) on or after `day` (`YYYY-MM-DD`) in the shop's time
 * zone: what a history floor keeps in a list (ADR-075).
 */
export function onOrAfterDay(
  column: string,
  organizationId: string,
  day: string,
) {
  return sql<boolean>`${sql.ref(column)} >= (${day}::date::timestamp at time zone (select o.timezone from app.organizations o where o.id = ${organizationId}))`;
}
