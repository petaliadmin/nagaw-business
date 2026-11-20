import { formatAmount } from '@nagaw/shared';
import { ScrollRegion } from '@/components/ui/scroll-region';

interface Point {
  key: string;
  label: string;
  revenue: number;
  count: number;
}

const shortDay = (day: string) =>
  new Intl.DateTimeFormat('fr', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
const longDay = (day: string) =>
  new Intl.DateTimeFormat('fr', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
const monthOf = (day: string) =>
  new Intl.DateTimeFormat('fr', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day.slice(0, 7)}-15T12:00:00Z`));

/** Days, or months beyond two months, so that bars stay readable. */
export function chartPoints(
  days: { day: string; revenue: number; count: number }[],
): Point[] {
  if (days.length <= 62)
    return days.map((d) => ({
      key: d.day,
      label: longDay(d.day),
      revenue: d.revenue,
      count: d.count,
    }));
  const months = new Map<string, Point>();
  for (const d of days) {
    const key = d.day.slice(0, 7);
    const point = months.get(key) ?? {
      key,
      label: monthOf(d.day),
      revenue: 0,
      count: 0,
    };
    point.revenue += d.revenue;
    point.count += d.count;
    months.set(key, point);
  }
  return [...months.values()];
}

/**
 * Sales of the period, one bar per day (or month). One series: the title
 * names it, no legend. The figures are also in a table, for keyboards and
 * screen readers; the bars only add a hover detail.
 */
export function SalesChart({
  days,
  currency,
}: {
  days: { day: string; revenue: number; count: number }[];
  currency: string;
}) {
  const points = chartPoints(days);
  const max = Math.max(...points.map((p) => p.revenue), 0);
  const money = (value: number) => formatAmount(value, currency);
  const byMonth = points.length > 0 && points[0]!.key.length === 7;
  const tickLabel = (p: Point) => (byMonth ? p.label : shortDay(p.key));

  const total = points.reduce((sum, p) => sum + p.revenue, 0);

  return (
    <figure className="flex flex-col gap-3">
      {/* V3 (ADR-063): the total beside the title, green columns, a small
          grey mark for the days without sales so that every day shows. */}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-bold text-ink-muted">
          Chiffre d’affaires par {byMonth ? 'mois' : 'jour'}
        </span>
        <span className="text-2xl font-extrabold tabular-nums">
          {money(total)}
        </span>
      </figcaption>
      {max === 0 ? (
        <p className="text-ink-muted">Aucune vente sur cette période.</p>
      ) : (
        <div aria-hidden className="flex flex-col gap-2">
          <div className="flex h-32 items-end gap-1">
            {points.map((p) => (
              <div
                key={p.key}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
              >
                {/* Hit area: the whole column, bigger than the bar. */}
                <div
                  className={`w-full max-w-7 rounded-md transition-opacity group-hover:opacity-80 ${
                    p.revenue > 0 ? 'bg-sales-strong' : 'bg-line'
                  }`}
                  style={{
                    height:
                      p.revenue > 0
                        ? `max(6px, ${(p.revenue / max) * 100}%)`
                        : '4px',
                  }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-48 -translate-x-1/2 rounded-2xl bg-ink px-3 py-2 text-base text-canvas group-hover:block">
                  <p className="font-bold">{p.label}</p>
                  <p className="tabular-nums">{money(p.revenue)}</p>
                  <p className="text-[#c9c5ff]">
                    {p.count} vente{p.count > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-bold text-ink-muted">
            <span>{tickLabel(points[0]!)}</span>
            {points.length > 1 && <span>{tickLabel(points.at(-1)!)}</span>}
          </div>
        </div>
      )}
      <details>
        <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-brand-ink underline underline-offset-4">
          Voir les chiffres en tableau
        </summary>
        <ScrollRegion
          label="Chiffre d’affaires et nombre de ventes"
          className="mt-2"
        >
          <table className="w-full text-left">
            <caption className="sr-only">
              Chiffre d’affaires et nombre de ventes
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">
                  {byMonth ? 'Mois' : 'Jour'}
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Chiffre d’affaires
                </th>
                <th scope="col" className="py-2 text-right">
                  Ventes
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {p.label}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {money(p.revenue)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </details>
    </figure>
  );
}
