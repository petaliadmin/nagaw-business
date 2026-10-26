'use client';

import { Ellipsis, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * « Plus » entry of the phone bottom bar: opens a bottom sheet with the
 * remaining navigation, the shop switcher and the account. Closes on
 * Escape, on navigation and on backdrop click; focus moves into the sheet
 * when it opens and back to the button when it closes.
 */
export function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close when the route changes (render-time adjustment, no effect needed).
  if (open && pathname !== openedAt) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('a, button, select')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

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
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Fermer le menu"
            tabIndex={-1}
            onClick={close}
            className="flex-1 bg-black/40"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[85vh] flex-col gap-6 overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id={titleId} className="text-xl font-extrabold">
                Plus
              </h2>
              <button
                type="button"
                onClick={close}
                className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-base font-bold text-ink hover:bg-surface-muted"
              >
                <X aria-hidden className="size-6" />
                Fermer
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </li>
  );
}
