'use client';

import { LogOut } from 'lucide-react';
import { useRef } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { buttonClasses } from '@/components/ui/button-styles';
import { eraseLocalData } from '@/lib/offline/db';
import { flushOutbox, outboxStatus } from '@/lib/offline/store';

/**
 * Signs out after erasing what this device keeps (ADR-020): the next
 * person on a shared phone sees nothing of the previous one. Sales not
 * sent yet are tried once more; if some remain, the person is warned.
 */
export function SignOutButton({
  tone = 'surface',
}: {
  tone?: 'surface' | 'sidebar';
}) {
  const erased = useRef(false);
  return (
    <form
      action={signOut}
      onSubmit={(event) => {
        if (erased.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        void (async () => {
          try {
            await flushOutbox();
            const { pendingSales } = await outboxStatus();
            if (
              pendingSales > 0 &&
              !window.confirm(
                `${pendingSales > 1 ? `${pendingSales} ventes n’ont` : 'Une vente n’a'} pas encore été envoyée${pendingSales > 1 ? 's' : ''} : elle${pendingSales > 1 ? 's seront perdues' : ' sera perdue'} si vous vous déconnectez maintenant. Reconnectez plutôt le téléphone à internet. Se déconnecter quand même ?`,
              )
            )
              return;
            await eraseLocalData();
          } catch (error) {
            // No local base (private browsing): nothing to erase.
            console.warn('Effacement des données locales', error);
          }
          erased.current = true;
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
