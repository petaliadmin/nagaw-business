import { shareBasisPoints } from '@nagaw/shared';
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Figure } from '@/components/ui/figure';
import { MODULE_TONES, type ModuleTone } from './tones';

const percentFormat = new Intl.NumberFormat('fr', {
  maximumFractionDigits: 0,
});

/** A share in basis points, as « 23 % ». */
export function percent(basisPoints: number): string {
  return `${percentFormat.format(basisPoints / 100)} %`;
}

/**
 * How a figure moved since the period before, on a dark tile (text in
 * its colour). The arrow and its colour only repeat the words: up is
 * good, except for `higherIsWorse` figures.
 */
export function Change({
  current,
  previous,
  higherIsWorse = false,
}: {
  current: number;
  previous: number;
  higherIsWorse?: boolean;
}) {
  if (previous === 0)
    return (
      <p className="text-base">{current === 0 ? 'Stable' : 'Rien avant'}</p>
    );
  const delta = shareBasisPoints(Math.abs(current - previous), previous);
  if (delta === 0)
    return (
      <p className="flex items-center gap-1.5 text-base">
        <Minus aria-hidden className="size-5 shrink-0" />
        Stable
      </p>
    );
  const up = current > previous;
  const good = up !== higherIsWorse;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className="flex items-center gap-1.5 text-base">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full bg-white ${
          good ? 'text-sales-strong' : 'text-danger-strong'
        }`}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="font-bold tabular-nums">
        <span className="sr-only">
          {up ? 'En hausse de ' : 'En baisse de '}
        </span>
        <span aria-hidden>{up ? '+' : '−'}</span>
        {percent(delta)}
      </span>
    </p>
  );
}

/**
 * A key figure in its module's colour, with how it moved: compact enough
 * for two per row on a 360 px phone, so that the essentials show at once.
 */
export function KpiTile({
  label,
  value,
  tone,
  icon: Icon,
  children,
}: {
  label: string;
  value: ReactNode;
  tone: ModuleTone;
  icon: LucideIcon;
  /** A change or a short explanation, under the value. */
  children?: ReactNode;
}) {
  const colors = MODULE_TONES[tone];
  return (
    <div
      className={`@container flex min-w-0 flex-col gap-1.5 rounded-2xl p-3 shadow-sm sm:p-4 ${colors.dark}`}
    >
      <dt className="flex items-center gap-2 text-base leading-tight font-bold">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20 sm:size-9 sm:rounded-xl">
          <Icon aria-hidden className="size-5" />
        </span>
        {label}
      </dt>
      <dd className="flex flex-col gap-1">
        <Figure
          value={value}
          className="font-extrabold tabular-nums [--figure-max:1.25rem] sm:[--figure-max:1.5rem]"
        />
        {children}
      </dd>
    </div>
  );
}

/**
 * Rows with a bar in proportion of the largest value: one series, so the
 * title names it and every row says its value in words.
 */
export function BarList({
  label,
  rows,
  tone,
}: {
  label: string;
  rows: {
    key: string;
    name: ReactNode;
    value: number;
    /** The value as shown, with its detail. */
    text: ReactNode;
  }[];
  tone: ModuleTone;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <ol aria-label={label} className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="min-w-0 font-semibold break-words">
              {row.name}
            </span>
            <span className="font-bold tabular-nums">{row.text}</span>
          </div>
          <div aria-hidden className="h-3 rounded-full bg-surface-muted">
            <div
              className={`h-3 rounded-full ${MODULE_TONES[tone].bar}`}
              style={{
                width:
                  max > 0 && row.value > 0
                    ? `max(0.75rem, ${(row.value / max) * 100}%)`
                    : 0,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
