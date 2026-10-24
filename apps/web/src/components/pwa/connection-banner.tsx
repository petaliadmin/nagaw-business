'use client';

import { WifiOff } from 'lucide-react';
import { useOffline } from 'next/offline';

/**
 * Always-visible connection state (DESIGN.md). Shown only when offline:
 * there is no pending data to report yet (offline sales come in Phase 11),
 * so nothing is claimed while online.
 */
export function ConnectionBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex print:hidden items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-base font-bold text-on-vivid"
    >
      <WifiOff aria-hidden className="size-5 shrink-0" />
      Pas de connexion internet. Ce qui est affiché reste visible ; le reste
      reviendra avec le réseau.
    </div>
  );
}
