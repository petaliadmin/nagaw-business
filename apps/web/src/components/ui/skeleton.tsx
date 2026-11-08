/**
 * Loading skeletons: grey shapes where the content will come, so that the
 * page keeps its layout while it loads. They pulse gently, never when the
 * person asked for less motion (DESIGN.md), and screen readers hear one
 * « Chargement… » only (the shapes are hidden from them).
 */

import type { ReactNode } from 'react';

const PULSE = 'animate-pulse motion-reduce:animate-none';

/** One grey shape. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`${PULSE} rounded-xl bg-surface-muted ${className}`}
    />
  );
}

/** The title of a page, and the line under it. */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-5 w-40 max-w-full" />
      </div>
      {action && <Skeleton className="h-12 w-40 rounded-2xl" />}
    </div>
  );
}

/** A card with its title and a few lines. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 md:p-6"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0" />
        <Skeleton className="h-6 w-40" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/** Figures in tiles, as on the dashboard. */
export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 shrink-0" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Rows of a list: a square, two lines, a figure on the right. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex min-h-20 items-center gap-4 rounded-2xl border border-line bg-surface p-3"
        >
          <Skeleton className="size-14 shrink-0 rounded-2xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

/** Fields of a form, then its button. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 md:p-6"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-12 w-48 rounded-2xl" />
    </div>
  );
}

/**
 * The frame of the app while it loads: the sidebar on a computer, the top
 * and bottom bars on a phone, with the page skeleton in its place.
 */
export function ShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <div
        aria-hidden
        className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 bg-sidebar p-4 md:flex"
      >
        <div className={`${PULSE} h-12 w-44 rounded-xl bg-white/10`} />
        <div className={`${PULSE} h-14 rounded-xl bg-white/10`} />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${PULSE} h-12 rounded-xl bg-white/10`} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-surface px-4 md:hidden"
        >
          <Skeleton className="size-10" />
          <Skeleton className="h-6 w-40" />
        </div>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-4 pb-28 md:p-8">
          {children}
        </main>
      </div>
      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden"
      >
        <div className="mx-auto flex max-w-xl gap-1 px-2 py-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <Skeleton className="size-7" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
