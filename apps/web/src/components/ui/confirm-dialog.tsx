'use client';

import { TriangleAlert } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { buttonClasses } from './button-styles';

export interface ConfirmOptions {
  /** The question, short: « Vider le panier ? ». */
  title: string;
  /** What will happen, in everyday words. */
  message?: string;
  /** The action, as a verb: « Vider ». */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for what removes or empties something. */
  tone?: 'danger' | 'primary';
}

interface Pending {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * The app's confirmation window, in place of the browser's `confirm()`:
 * same look as the rest of the app, large buttons, words of the shop. A
 * native modal <dialog> with the alertdialog role: focus stays inside,
 * the page behind is inert, Escape and a tap outside cancel. « Annuler »
 * has the focus first, so that a hurried tap never removes anything.
 */
function ConfirmDialog({
  pending,
  onAnswer,
}: {
  pending: Pending | null;
  onAnswer: (confirmed: boolean) => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    }
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  const options = pending?.options;
  const danger = (options?.tone ?? 'danger') === 'danger';
  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={options?.message ? messageId : undefined}
      // Escape: the browser closes the dialog; it counts as « Annuler ».
      onClose={() => {
        if (pending) onAnswer(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onAnswer(false);
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 md:inset-auto md:top-1/2 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
    >
      {options && (
        <div className="flex flex-col gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                danger
                  ? 'bg-danger-soft text-danger-ink'
                  : 'bg-brand-soft text-brand-ink'
              }`}
            >
              <TriangleAlert className="size-6" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={titleId} className="text-xl font-bold">
                {options.title}
              </h2>
              {options.message && (
                <p id={messageId} className="text-ink-muted">
                  {options.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => onAnswer(false)}
              className={buttonClasses('secondary', 'w-full sm:w-auto')}
            >
              {options.cancelLabel ?? 'Annuler'}
            </button>
            <button
              type="button"
              onClick={() => onAnswer(true)}
              className={buttonClasses(
                danger ? 'danger' : 'primary',
                'w-full sm:w-auto',
              )}
            >
              {options.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * `const [confirm, confirmDialog] = useConfirm()`: `await confirm({...})`
 * resolves with the answer; render `confirmDialog` once in the component.
 */
export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  ReactNode,
] {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );
  const dialog = (
    <ConfirmDialog
      pending={pending}
      onAnswer={(confirmed) => {
        pending?.resolve(confirmed);
        setPending(null);
      }}
    />
  );
  return [confirm, dialog];
}

/**
 * For a form: `onSubmit={(event) => guard(event, options)}` holds the
 * submission back, asks, and submits again (with the same button) once
 * confirmed. `options` null: no question, the form goes at once.
 */
export function useConfirmedSubmit(): [
  (event: FormEvent<HTMLFormElement>, options: ConfirmOptions | null) => void,
  ReactNode,
] {
  const [confirm, dialog] = useConfirm();
  const confirmed = useRef(false);
  const guard = useCallback(
    (event: FormEvent<HTMLFormElement>, options: ConfirmOptions | null) => {
      if (!options || confirmed.current) {
        confirmed.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const form = event.currentTarget;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      void confirm(options).then((ok) => {
        if (!ok) return;
        confirmed.current = true;
        form.requestSubmit(submitter instanceof HTMLElement ? submitter : null);
      });
    },
    [confirm],
  );
  return [guard, dialog];
}
