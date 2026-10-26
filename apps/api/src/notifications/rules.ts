import {
  formatAmount,
  formatQuantity,
  NOTIFICATION_CATEGORY_RULES,
  roleHasPermission,
  type NotificationCategory,
  type NotificationSeverity,
  type Role,
} from '@nagaw/shared';

/**
 * Decisions behind the notifications (ADR-036), kept free of the database
 * so that they are tested on their own. « Intelligent » here means: tell
 * once when something changes (a threshold is crossed), group what repeats
 * (the day's sales), look ahead (days of stock left at the current pace)
 * and stay quiet when there is nothing to say.
 */

export { formatQuantity };

export type StockCrossing = 'out' | 'low' | null;

/**
 * Only the movement that crosses a line is worth a message: the sale that
 * empties the shelf, not every sale that follows it.
 */
export function stockCrossing(
  before: number,
  after: number,
  threshold: number | null,
): StockCrossing {
  if (after >= before) return null;
  if (before > 0 && after <= 0) return 'out';
  if (threshold !== null && before > threshold && after <= threshold)
    return 'low';
  return null;
}

/**
 * Days the stock lasts at the pace of the last `windowDays` days, or null
 * when nothing sold (no pace to project).
 */
export function forecastDaysLeft(
  stock: number,
  soldInWindow: number,
  windowDays: number,
): number | null {
  if (soldInWindow <= 0 || windowDays <= 0) return null;
  if (stock <= 0) return 0;
  return stock / (soldInWindow / windowDays);
}

/** « environ 2 jours », « moins d’un jour ». */
export function formatDaysLeft(days: number): string {
  if (days < 1) return 'moins d’un jour';
  const rounded = Math.floor(days);
  return `environ ${rounded} jour${rounded > 1 ? 's' : ''}`;
}

/** Change from `previous` to `current`, in whole percent; null without base. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** True when a credit sale brings the debt to the warning share of the limit. */
export function nearCreditLimit(
  balanceBefore: number,
  balanceAfter: number,
  limit: number | null,
  percent: number,
): boolean {
  if (limit === null || limit <= 0) return false;
  const line = (limit * percent) / 100;
  return balanceBefore < line && balanceAfter >= line;
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  info: 0,
  warning: 1,
  danger: 2,
};

export function moreSevere(
  next: NotificationSeverity,
  previous: NotificationSeverity,
): boolean {
  return SEVERITY_RANK[next] > SEVERITY_RANK[previous];
}

export interface Member {
  userId: string;
  role: Role;
}

export interface Preference {
  userId: string;
  category: NotificationCategory;
  enabled: boolean;
  push: boolean;
}

export interface Recipient {
  userId: string;
  push: boolean;
}

/**
 * Who receives a notification: members whose role may read what it talks
 * about, minus the person who acted, following each person's choice or,
 * without one, the default of the role. Push follows the same choice.
 */
export function recipientsFor(
  category: NotificationCategory,
  members: readonly Member[],
  preferences: readonly Preference[],
  options: { exceptUserId?: string | null; onlyUserIds?: readonly string[] },
): Recipient[] {
  const rule = NOTIFICATION_CATEGORY_RULES[category];
  return members.flatMap((member) => {
    if (member.userId === options.exceptUserId) return [];
    if (options.onlyUserIds && !options.onlyUserIds.includes(member.userId))
      return [];
    if (!roleHasPermission(member.role, rule.permission)) return [];
    const choice = preferences.find(
      (p) => p.userId === member.userId && p.category === category,
    );
    const enabled = choice
      ? choice.enabled
      : rule.defaultRoles.includes(member.role);
    if (!enabled) return [];
    return [{ userId: member.userId, push: choice ? choice.push : true }];
  });
}

/** Running count and total of a group of events (« 5 ventes · 45 000 F »). */
export interface Tally {
  count: number;
  total: number;
}

export function addToTally(previous: unknown, amount: number): Tally {
  const base =
    previous && typeof previous === 'object'
      ? (previous as Partial<Tally>)
      : {};
  return {
    count: (Number.isFinite(base.count) ? Number(base.count) : 0) + 1,
    total: (Number.isFinite(base.total) ? Number(base.total) : 0) + amount,
  };
}

/** Keeps the last `max` lines of a grouped notification's body. */
export function appendLine(previous: unknown, line: string, max = 5): string[] {
  const lines = Array.isArray(previous)
    ? previous.filter((l): l is string => typeof l === 'string')
    : [];
  return [...lines, line].slice(-max);
}

export interface DaySummary {
  dayLabel: string;
  currency: string;
  sales: { count: number; total: number; cancelled: number };
  lastWeekTotal: number;
  credit: number;
  topProducts: { label: string; total: number }[];
  invoices: { count: number; total: number };
  expenses: { count: number; total: number };
  stock: { low: number; out: number };
}

/** True when the day has nothing to report: no summary is sent. */
export function isQuietDay(summary: DaySummary): boolean {
  return (
    summary.sales.count === 0 &&
    summary.sales.cancelled === 0 &&
    summary.invoices.count === 0 &&
    summary.expenses.count === 0
  );
}

/** Title and body of the evening summary, in everyday words. */
export function summaryText(summary: DaySummary): {
  title: string;
  body: string;
} {
  const money = (value: number) => formatAmount(value, summary.currency);
  const s = summary.sales;
  const lines: string[] = [];
  const change = percentChange(s.total, summary.lastWeekTotal);
  lines.push(
    `${s.count} vente${s.count > 1 ? 's' : ''} : ${money(s.total)}` +
      (change === null
        ? '.'
        : change === 0
          ? ', comme la semaine dernière.'
          : `, ${change > 0 ? '+' : ''}${change} % par rapport à la semaine dernière.`),
  );
  if (s.cancelled > 0)
    lines.push(
      `${s.cancelled} vente${s.cancelled > 1 ? 's annulées' : ' annulée'}.`,
    );
  if (summary.credit > 0)
    lines.push(`Vendu à crédit : ${money(summary.credit)}.`);
  if (summary.topProducts.length > 0)
    lines.push(
      `Meilleurs produits : ${summary.topProducts
        .map((p) => `${p.label} (${money(p.total)})`)
        .join(', ')}.`,
    );
  if (summary.invoices.count > 0)
    lines.push(
      `${summary.invoices.count} facture${summary.invoices.count > 1 ? 's' : ''} : ${money(summary.invoices.total)}.`,
    );
  if (summary.expenses.count > 0)
    lines.push(
      `Dépenses : ${money(summary.expenses.total)} (${summary.expenses.count}).`,
    );
  const toBuy = summary.stock.low + summary.stock.out;
  if (toBuy > 0)
    lines.push(
      `À réapprovisionner : ${toBuy} produit${toBuy > 1 ? 's' : ''}` +
        (summary.stock.out > 0
          ? `, dont ${summary.stock.out} épuisé${summary.stock.out > 1 ? 's' : ''}.`
          : '.'),
    );
  return {
    title: `Résumé du ${summary.dayLabel}`,
    body: lines.join('\n').slice(0, 1000),
  };
}
