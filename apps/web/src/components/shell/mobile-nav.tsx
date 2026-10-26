'use client';

import { Ellipsis, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * « Plus » entry of the phone bottom bar: opens a bottom sheet with the
 * remaining navigation, the shop switcher and the account. A native modal
 * <dialog>: focus stays inside and the page behind is inert (WCAG 2.4.3).
 * Closes on Escape, on navigation and on backdrop click; focus moves into
 * the sheet when it opens and back to the button when it closes.
 */
export function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close when the route changes (render-time adjustment, no effect needed).
  if (open && pathname !== openedAt) {
    setOpen(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
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
      <dialog
        ref={dialogRef}
        id={panelId}
        aria-labelledby={titleId}
        // Escape: the browser closes the dialog, the state follows.
        onClose={close}
        // The dialog box itself is only hit outside the panel: the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
      >
        {open && (
          <div className="flex flex-col gap-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
        )}
      </dialog>
    </li>
  );
}
