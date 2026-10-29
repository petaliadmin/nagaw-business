'use client';

import { Download, Share, SquarePlus, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { buttonClasses } from '@/components/ui/button-styles';
import {
  currentInstallState,
  dismissInstall,
  installDismissed,
  promptInstall,
  subscribeInstall,
  type InstallState,
} from '@/lib/pwa/install';

/** `state|dismissed`: a primitive, as useSyncExternalStore wants it. */
function useInstall(): { state: InstallState; dismissed: boolean } {
  const snapshot = useSyncExternalStore(
    subscribeInstall,
    () => `${currentInstallState()}|${installDismissed() ? 1 : 0}`,
    // On the server, nothing is offered: no flash before hydration.
    () => 'unavailable|1',
  );
  const [state, dismissed] = snapshot.split('|') as [InstallState, string];
  return { state, dismissed: dismissed === '1' };
}

/**
 * The dialog itself: a native modal <dialog> (focus kept inside, Escape
 * closes it), like the « Plus » menu.
 */
function InstallSheet({
  open,
  state,
  onClose,
}: {
  open: boolean;
  state: InstallState;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function install() {
    setInstalling(true);
    try {
      await promptInstall();
    } catch (error) {
      console.error('Installation impossible', error);
    } finally {
      setInstalling(false);
      // Installed or refused, the dialog closes; the menu button stays
      // for those who refused.
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 md:inset-auto md:top-1/2 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-2">
            <h2 id={titleId} className="text-xl font-extrabold">
              Installer Nagaw Business
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl hover:bg-surface-muted"
            >
              <X aria-hidden className="size-6" />
            </button>
          </div>
          <p>
            Mettez l’application sur l’écran d’accueil : elle s’ouvre d’un
            geste, en plein écran, comme une application.
          </p>
          {state === 'ios' ? (
            <>
              <ol className="flex flex-col gap-3">
                <li className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                    <Share aria-hidden className="size-5" />
                  </span>
                  <span>
                    1. Touchez <strong>Partager</strong>, en bas de l’écran.
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                    <SquarePlus aria-hidden className="size-5" />
                  </span>
                  <span>
                    2. Choisissez <strong>Sur l’écran d’accueil</strong>, puis{' '}
                    <strong>Ajouter</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={onClose}
                className={buttonClasses('primary', 'w-full')}
              >
                J’ai compris
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void install()}
                disabled={installing}
                className={buttonClasses('primary', 'w-full sm:w-auto')}
              >
                <Download aria-hidden className="size-5" />
                {installing ? 'Un instant…' : 'Installer'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={buttonClasses('secondary', 'w-full sm:w-auto')}
              >
                Plus tard
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/**
 * Proposed once, when the application is not installed and the browser
 * can install it. Closing it (« Plus tard », Escape, refusing the
 * browser's window) leaves the job to the menu button.
 */
export function InstallDialog() {
  const { state, dismissed } = useInstall();
  const offered = (state === 'prompt' || state === 'ios') && !dismissed;
  return <InstallSheet open={offered} state={state} onClose={dismissInstall} />;
}

/** « Installer l’application » in the side menu, once the dialog was closed. */
export function InstallButton({
  tone = 'surface',
}: {
  tone?: 'surface' | 'sidebar';
}) {
  const { state, dismissed } = useInstall();
  const [instructions, setInstructions] = useState(false);
  if (!dismissed || (state !== 'prompt' && state !== 'ios')) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (state === 'ios') setInstructions(true);
          else
            void promptInstall().catch((error: unknown) =>
              console.error('Installation impossible', error),
            );
        }}
        className={
          tone === 'sidebar'
            ? 'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-bold text-brand-ink hover:bg-white/90 focus-visible:outline-white'
            : buttonClasses('primary', 'w-full')
        }
      >
        <Download aria-hidden className="size-5" />
        Installer l’application
      </button>
      {state === 'ios' && (
        <InstallSheet
          open={instructions}
          state={state}
          onClose={() => setInstructions(false)}
        />
      )}
    </>
  );
}
