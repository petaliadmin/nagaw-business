import type { ReactNode } from 'react';
import { ScrollRegion } from '@/components/ui/scroll-region';

export interface ChartSeries {
  key: string;
  label: string;
  /** Fill of its marks: a `bg-chart-*` slot, in the fixed order. */
  fill: string;
}

export interface ChartPoint {
  key: string;
  /** Full label, in the tooltip and the table: « mardi 3 novembre ». */
  label: string;
  /** Short label under the axis: « 3 nov. ». */
  tick: string;
  /** One value per series, in the order of `series`. */
  values: number[];
  /** More detail for the tooltip and a last table column. */
  detail?: string;
}

/**
 * Columns over time, one series or stacked ones on a single axis (never
 * two scales). The title names a lone series; from two, a legend names
 * each. Hover shows a column's figures; every figure is also in the table
 * under the chart, for keyboards, screen readers and print.
 */
export function ColumnChart({
  title,
  series,
  points,
  format,
  empty,
  detailHeader,
}: {
  title: string;
  series: ChartSeries[];
  points: ChartPoint[];
  format: (value: number) => string;
  /** Said instead of the chart when every value is zero. */
  empty: string;
  detailHeader?: string;
}) {
  const total = (p: ChartPoint) => p.values.reduce((sum, v) => sum + v, 0);
  const max = Math.max(...points.map(total), 0);
  const middle = points[Math.floor((points.length - 1) / 2)];
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="text-lg font-bold">{title}</figcaption>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Légende">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-base">
              <span aria-hidden className={`size-3 rounded-sm ${s.fill}`} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {max === 0 ? (
        <p className="text-ink-muted">{empty}</p>
      ) : (
        <div aria-hidden className="flex flex-col gap-1">
          <span className="text-base text-ink-muted tabular-nums">
            {format(max)}
          </span>
          <div className="relative flex h-44 items-end gap-0.5 border-b border-line-strong">
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-line" />
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-line" />
            {points.map((p) => {
              const sum = total(p);
              return (
                <div
                  key={p.key}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center hover:bg-surface-muted"
                >
                  {sum > 0 && (
                    <div
                      className="flex w-full max-w-8 flex-col-reverse gap-0.5 overflow-hidden rounded-t-[4px]"
                      style={{ height: `max(2px, ${(sum / max) * 100}%)` }}
                    >
                      {series.map((s, i) =>
                        p.values[i]! > 0 ? (
                          <div
                            key={s.key}
                            className={`min-h-px ${s.fill}`}
                            style={{ flexGrow: p.values[i] }}
                          />
                        ) : null,
                      )}
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink shadow-md group-hover:block">
                    <p className="font-semibold">{p.label}</p>
                    {series.map((s, i) => (
                      <p key={s.key} className="flex items-center gap-2">
                        {series.length > 1 && (
                          <span className={`size-3 rounded-sm ${s.fill}`} />
                        )}
                        <span className="tabular-nums">
                          {series.length > 1 ? `${s.label} : ` : ''}
                          {format(p.values[i]!)}
                        </span>
                      </p>
                    ))}
                    {p.detail && <p className="text-ink-muted">{p.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between gap-2 text-base text-ink-muted">
            <span>{points[0]!.tick}</span>
            {points.length > 2 && <span>{middle!.tick}</span>}
            {points.length > 1 && <span>{points.at(-1)!.tick}</span>}
          </div>
        </div>
      )}
      <details>
        <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-brand-ink underline underline-offset-4">
          Voir les chiffres en tableau
        </summary>
        <ScrollRegion label={title} className="mt-2">
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">
                  Période
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-2 pr-3 text-right">
                    {s.label}
                  </th>
                ))}
                {detailHeader && (
                  <th scope="col" className="py-2 text-right">
                    {detailHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {p.label}
                  </th>
                  {series.map((s, i) => (
                    <td
                      key={s.key}
                      className="py-2 pr-3 text-right tabular-nums"
                    >
                      {format(p.values[i]!)}
                    </td>
                  ))}
                  {detailHeader && (
                    <td className="py-2 text-right tabular-nums">{p.detail}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </details>
    </figure>
  );
}

/** Parts of a whole on one bar, with a legend that says every figure. */
export function ShareBar({
  label,
  parts,
}: {
  label: string;
  parts: {
    key: string;
    label: string;
    value: number;
    fill: string;
    text: ReactNode;
  }[];
}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="flex flex-col gap-3">
      {total > 0 && (
        <div
          aria-hidden
          className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-surface-muted"
        >
          {parts.map((p) =>
            p.value > 0 ? (
              <div
                key={p.key}
                className={p.fill}
                style={{ flexGrow: p.value }}
              />
            ) : null,
          )}
        </div>
      )}
      <ul aria-label={label} className="flex flex-col gap-2">
        {parts.map((p) => (
          <li
            key={p.key}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
          >
            <span className="flex items-center gap-2 font-semibold">
              <span aria-hidden className={`size-3 rounded-sm ${p.fill}`} />
              {p.label}
            </span>
            <span className="tabular-nums">{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
