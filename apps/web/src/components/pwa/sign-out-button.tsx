'use client';

import { LogOut } from 'lucide-react';
import { useRef } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { buttonClasses } from '@/components/ui/button-styles';
import { flushOutbox, lockCheckout } from '@/lib/offline/store';

/**
 * Signs out and closes the checkout of this device, which keeps all it
 * holds (ADR-053): sales not sent yet leave with the next person of the
 * shop who signs in here. « Effacer ce téléphone », in Paramètres, is the
 * only way to empty it.
 */
export function SignOutButton({
  tone = 'surface',
}: {
  tone?: 'surface' | 'sidebar';
}) {
  const done = useRef(false);
  return (
    <form
      action={signOut}
      onSubmit={(event) => {
        if (done.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        void (async () => {
          try {
            await flushOutbox();
            await lockCheckout();
          } catch (error) {
            // No local base (private browsing): nothing to keep or close.
            console.warn('Fermeture de la caisse de ce téléphone', error);
          }
          done.current = true;
          form.requestSubmit();
        })();
      }}
    >
      <button
        type="submit"
        className={
          tone === 'sidebar'
            ? 'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-white/70 px-4 text-base font-bold text-white hover:bg-white/15 focus-visible:outline-white'
            : buttonClasses('secondary', 'w-full')
        }
      >
        <LogOut aria-hidden className="size-5" />
        Se déconnecter
      </button>
    </form>
  );
}
