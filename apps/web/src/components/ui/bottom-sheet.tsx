'use client';

import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type TouchEvent,
} from 'react';

/** How far the sheet is pulled down before letting it go closes it. */
const CLOSE_DISTANCE_PX = 80;

/**
 * A panel rising from the bottom of the phone (centred on a computer). A
 * native modal <dialog>: focus stays inside, the page behind is inert
 * (WCAG 2.4.3), Escape and the Android back button close it. It also
 * closes on a backdrop tap and when pulled down by its top; « Fermer »
 * does the same without the gesture (WCAG 2.5.7).
 */
export function BottomSheet({
  id,
  open,
  title,
  onClose,
  children,
}: {
  id?: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pullFrom = useRef<number | null>(null);
  const pulled = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const follow = (event: TouchEvent) => {
    const from = pullFrom.current;
    const dialog = dialogRef.current;
    const y = event.touches[0]?.clientY;
    if (from === null || !dialog || y === undefined) return;
    pulled.current = Math.max(0, y - from);
    dialog.style.transform = `translateY(${pulled.current}px)`;
  };

  const release = () => {
    if (dialogRef.current) dialogRef.current.style.transform = '';
    if (pulled.current > CLOSE_DISTANCE_PX) onClose();
    pullFrom.current = null;
    pulled.current = 0;
  };

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={titleId}
      // Escape: the browser closes the dialog, the state follows.
      onClose={() => {
        if (open) onClose();
      }}
      // The dialog box itself is only hit outside the panel: the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 md:inset-auto md:top-1/2 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
    >
      {open && (
        <div className="flex flex-col gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div
            onTouchStart={(event) => {
              pullFrom.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchMove={follow}
            onTouchEnd={release}
            className="sticky top-0 z-10 -mx-4 flex touch-none flex-col gap-1 bg-surface px-4 pt-2"
          >
            <span
              aria-hidden
              className="mx-auto h-1.5 w-12 rounded-full bg-line-strong md:hidden"
            />
            <div className="flex items-center justify-between gap-2">
              <h2 id={titleId} className="text-xl font-extrabold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-base font-bold text-ink hover:bg-surface-muted"
              >
                <X aria-hidden className="size-6" />
                Fermer
              </button>
            </div>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
