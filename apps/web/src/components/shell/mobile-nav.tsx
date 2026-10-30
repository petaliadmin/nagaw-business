'use client';

import { Ellipsis } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

/**
 * « Plus » entry of the phone bottom bar: opens a bottom sheet with the
 * remaining navigation, the shop switcher and the account. Closes on
 * navigation too; focus moves into the sheet when it opens and back to
 * the button when it closes.
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
    <li className="flex-1">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
        className={`flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-base font-bold ${
          open ? 'text-brand-ink' : 'text-ink-muted'
        }`}
      >
        <span
          className={`flex h-8 w-14 items-center justify-center rounded-full ${
            open ? 'bg-brand-strong text-white shadow-sm' : ''
          }`}
        >
          <Ellipsis aria-hidden className="size-6" />
        </span>
        Plus
      </button>
      <BottomSheet id={panelId} open={open} title="Plus" onClose={close}>
        {children}
      </BottomSheet>
    </li>
  );
}
