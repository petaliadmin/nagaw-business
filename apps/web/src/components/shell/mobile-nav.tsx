'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

/**
 * « Menu » in the phone top bar: opens a bottom sheet with the pages that
 * are not in the bottom bar, the shop switcher and the account (ADR-062).
 * Closes on navigation too; focus moves into the sheet when it opens and
 * back to the button when it closes.
 */
export function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close when the route changes (render-time adjustment, no effect needed).
  if (open && pathname !== openedAt) {
    setOpen(false);
  }

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
        className={`-mr-2 flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-2 text-base font-bold ${
          open ? 'bg-brand-soft text-brand-ink' : 'text-ink'
        }`}
      >
        <Menu aria-hidden className="size-6" />
        Menu
      </button>
      <BottomSheet id={panelId} open={open} title="Menu" onClose={close}>
        {children}
      </BottomSheet>
    </>
  );
}
