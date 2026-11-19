'use client';

import { Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { PERIODS, type PeriodKey } from '@/lib/treasury/period';

/**
 * The period as one pill in the dark card (ADR-063): « Ce mois ▾ » opens
 * the other periods above the figures, instead of a whole row of buttons.
 * Escape or a touch outside closes it.
 */
export function PeriodMenu({
  path,
  current,
}: {
  path: string;
  current: PeriodKey | 'perso';
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const label = PERIODS.find((p) => p.key === current)?.label ?? 'Autres dates';

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-white/15 pr-3 pl-4 font-extrabold text-canvas focus-visible:outline-white"
      >
        <span className="sr-only">Période : </span>
        {label}
        <ChevronDown
          aria-hidden
          className={`size-5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          id={listId}
          aria-label="Période"
          className="absolute top-full left-0 z-20 mt-2 flex w-56 flex-col rounded-3xl bg-canvas p-2 text-ink shadow-lg ring-1 ring-line"
        >
          {PERIODS.map((p) => (
            <li key={p.key}>
              <Link
                href={`${path}?${new URLSearchParams({ periode: p.key })}`}
                aria-current={current === p.key ? 'true' : undefined}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center justify-between gap-2 rounded-2xl px-4 font-bold hover:bg-surface aria-[current]:bg-surface"
              >
                {p.label}
                {current === p.key && (
                  <Check aria-hidden className="size-5 shrink-0" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
