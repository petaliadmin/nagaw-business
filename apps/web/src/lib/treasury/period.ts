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
