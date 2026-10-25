/** Periods offered on the statistics and treasury pages. */
export const PERIODS = [
  { key: 'jour', label: 'Aujourd’hui' },
  { key: 'hier', label: 'Hier' },
  { key: '7j', label: '7 jours' },
  { key: 'mois', label: 'Ce mois' },
  { key: 'mois-precedent', label: 'Mois dernier' },
] as const;
export type PeriodKey = (typeof PERIODS)[number]['key'];

function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Days covered by the search parameters, `today` being the shop's day:
 * a named period, or `du`/`au` chosen by hand (the API checks the span).
 */
export function resolvePeriod(
  params: Record<string, string | string[] | undefined>,
  today: string,
  fallback: PeriodKey = 'jour',
): { key: PeriodKey | 'perso'; from: string; to: string } {
  const from = typeof params.du === 'string' ? params.du : '';
  const to = typeof params.au === 'string' ? params.au : '';
  if (DAY_RE.test(from) && DAY_RE.test(to) && from <= to)
    return { key: 'perso', from, to };
  const asked = typeof params.periode === 'string' ? params.periode : '';
  const key = (PERIODS.find((p) => p.key === asked)?.key ??
    fallback) as PeriodKey;
  const month = today.slice(0, 8);
  switch (key) {
    case 'jour':
      return { key, from: today, to: today };
    case 'hier':
      return { key, from: addDays(today, -1), to: addDays(today, -1) };
    case '7j':
      return { key, from: addDays(today, -6), to: today };
    case 'mois':
      return { key, from: `${month}01`, to: today };
    case 'mois-precedent': {
      const lastDay = addDays(`${month}01`, -1);
      return { key, from: `${lastDay.slice(0, 8)}01`, to: lastDay };
    }
  }
}

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );

/**
 * The period to compare with: the same days of the month before when the
 * period starts on the 1st and stays in one month, otherwise as many days
 * just before.
 */
export function previousPeriod(
  from: string,
  to: string,
): { from: string; to: string } {
  if (from.endsWith('-01') && from.slice(0, 7) === to.slice(0, 7)) {
    const lastDay = addDays(from, -1);
    const day = Math.min(Number(to.slice(8)), Number(lastDay.slice(8)));
    return {
      from: `${lastDay.slice(0, 8)}01`,
      to: `${lastDay.slice(0, 8)}${String(day).padStart(2, '0')}`,
    };
  }
  const length = daysBetween(from, to) + 1;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}
