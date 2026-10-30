'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { buttonClasses } from '@/components/ui/button-styles';

/**
 * « Filtrer », next to the search: the filters wait in a sheet so that the
 * products come first on a phone. Choosing one closes it (ADR-044).
 */
export function ProductFilters({
  activeCount,
  children,
}: {
  /** How many filters are on: shown on the button. */
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={buttonClasses('secondary', 'shrink-0 px-3')}
      >
        <SlidersHorizontal aria-hidden className="size-5" />
        Filtrer
        {activeCount > 0 && (
          <span className="flex size-6 items-center justify-center rounded-full bg-stock-strong text-base leading-none text-white">
            <span className="sr-only">, filtres actifs : </span>
            {activeCount}
          </span>
        )}
      </button>
      <BottomSheet
        open={open}
        title="Filtrer les produits"
        onClose={() => setOpen(false)}
      >
        <div
          className="flex flex-col gap-6"
          onClick={(event) => {
            if ((event.target as Element).closest('a')) setOpen(false);
          }}
        >
          {children}
        </div>
      </BottomSheet>
    </>
  );
}
