import { ShoppingCart, WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button-link';
import { Logo } from '@/components/ui/logo';
import { RetryButton } from './retry-button';

export const metadata: Metadata = {
  title: 'Pas de connexion — Nagaw Business',
};

/**
 * Static page cached by the service worker and shown when a page cannot be
 * loaded offline. It must not depend on the session or on the API.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Logo href="/espace" />
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-8">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-warning text-on-vivid">
          <WifiOff aria-hidden className="size-9" />
        </span>
        <h1 className="text-3xl font-extrabold">Pas de connexion</h1>
        <p className="text-lg">
          Cette page n’a pas pu s’ouvrir car votre téléphone n’est pas connecté
          à internet.
        </p>
        <p className="text-ink-muted">
          Vérifiez le Wi-Fi ou les données mobiles, puis réessayez. Vos données
          sont en sécurité sur le serveur.
        </p>
        <RetryButton />
        <p className="text-ink-muted">
          Pour vendre sans connexion, ouvrez la caisse : elle garde vos produits
          sur ce téléphone.
        </p>
        <ButtonLink href="/caisse" variant="sell" className="w-full">
          <ShoppingCart aria-hidden className="size-5" />
          Ouvrir la caisse
        </ButtonLink>
      </div>
    </main>
  );
}
