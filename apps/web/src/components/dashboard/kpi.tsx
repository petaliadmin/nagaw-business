import { shareBasisPoints } from '@nagaw/shared';
import {
  ChevronRight,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
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
 * How a figure moved since the period before, on a light tile. The arrow
 * and its colour only repeat the words: up is good, except for
 * `higherIsWorse` figures.
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
    <p
      className={`flex w-fit items-center gap-1 rounded-full px-2 text-base ${
        good ? 'bg-sales-soft text-sales-ink' : 'bg-danger-soft text-danger-ink'
      }`}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
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
 * A key figure, with how it moved: compact enough for two per row on a
 * 360 px phone, so that the essentials show at once. A light tile with its
 * module's colour on the icon only, so that six of them stay calm together.
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
    <div className="@container flex min-w-0 flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3 shadow-sm sm:p-4">
      <dt className="flex items-center gap-2 text-base leading-tight font-bold text-ink-muted">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl ${colors.badge}`}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        {label}
      </dt>
      <dd className="flex flex-col gap-1 text-ink-muted">
        <Figure
          value={value}
          className="font-extrabold text-ink tabular-nums [--figure-max:1.25rem] sm:[--figure-max:1.5rem]"
        />
        {children}
      </dd>
    </div>
  );
}

/**
 * A secondary figure on a neutral tile, for the cards under the key
 * figures: lighter than a `KpiTile`, so that the essentials stand out. The
 * module's colour is on the icon only (the amber ink would fall just under
 * 4.5:1 on this background).
 */
export function SoftStat({
  label,
  value,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone: ModuleTone;
  icon: LucideIcon;
  /** A few words under the value. */
  hint?: string;
}) {
  const colors = MODULE_TONES[tone];
  return (
    <div className="@container flex min-w-0 flex-col gap-1 rounded-xl bg-surface-muted p-3">
      <dt className="flex items-center gap-2 text-base leading-tight font-bold text-ink">
        <Icon aria-hidden className={`size-5 shrink-0 ${colors.ink}`} />
        {label}
      </dt>
      <dd className="flex flex-col gap-0.5">
        <Figure
          value={value}
          className="font-extrabold text-ink tabular-nums [--figure-max:1.5rem]"
        />
        {hint && <p className="text-base text-ink-muted">{hint}</p>}
      </dd>
    </div>
  );
}

/** « Tout voir » beside a card title, named in full for screen readers. */
export function SeeAll({ href, what }: { href: string; what: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-1 font-bold text-brand-ink underline-offset-4 hover:underline"
    >
      Tout voir<span className="sr-only"> : {what}</span>
      <ChevronRight aria-hidden className="size-5" />
    </Link>
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
