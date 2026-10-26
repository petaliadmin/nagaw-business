'use client';

import { CloudUpload, TriangleAlert, WifiOff } from 'lucide-react';
import { useOffline } from 'next/offline';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  flushOutbox,
  outboxStatus,
  OUTBOX_EVENT,
  type OutboxStatus,
} from '@/lib/offline/store';

const RETRY_MS = 30_000;

const sales = (n: number) => (n > 1 ? `${n} ventes` : `${n} vente`);

/**
 * Always-visible connection and sending state (DESIGN.md, ADR-020). Also
 * sends the sales waiting on this device: at start, when the network
 * returns, and every 30 s while some are waiting.
 */
export function ConnectionBanner() {
  const offline = useOffline();
  const [status, setStatus] = useState<OutboxStatus | null>(null);

  useEffect(() => {
    if (typeof indexedDB === 'undefined') return;
    let active = true;
    const load = () =>
      outboxStatus()
        .then((next) => {
          if (active) setStatus(next);
        })
        .catch((error: unknown) => {
          // Private browsing can refuse IndexedDB: nothing is stored then.
          console.warn('État des ventes en attente illisible', error);
        });
    const send = () => {
      void flushOutbox().then(load);
    };
    void load().then(send);
    window.addEventListener(OUTBOX_EVENT, load);
    window.addEventListener('online', send);
    const timer = window.setInterval(() => {
      if (navigator.onLine) send();
    }, RETRY_MS);
    return () => {
      active = false;
      window.removeEventListener(OUTBOX_EVENT, load);
      window.removeEventListener('online', send);
      window.clearInterval(timer);
    };
  }, []);

  const pending = status?.pendingSales ?? 0;
  const rejected = status?.rejected.length ?? 0;
  const blocked = status?.blocked.filter((b) => b.sales > 0) ?? [];
  if (!offline && pending === 0 && rejected === 0 && blocked.length === 0)
    return null;

  const base =
    'sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-base font-bold print:hidden';
  if (offline)
    return (
      <div role="status" className={`${base} bg-warning text-on-vivid`}>
        <WifiOff aria-hidden className="size-5 shrink-0" />
        {pending > 0
          ? `Pas de connexion. ${sales(pending)} gardée${pending > 1 ? 's' : ''} sur ce téléphone, envoyée${pending > 1 ? 's' : ''} au retour du réseau.`
          : 'Pas de connexion internet. Ce qui est affiché reste visible ; le reste reviendra avec le réseau.'}
      </div>
    );
  // Never « en attente » forever: say why they cannot leave, and what to do.
  if (blocked.length > 0) {
    const stuck = blocked.reduce((sum, b) => sum + b.sales, 0);
    const revoked = blocked.some((b) => b.code === 'DEVICE_REVOKED');
    const email = blocked.find((b) => b.email)?.email;
    return (
      <div role="status" className={`${base} bg-danger-strong text-white`}>
        <TriangleAlert aria-hidden className="size-5 shrink-0" />
        {revoked
          ? `${sales(stuck)} bloquée${stuck > 1 ? 's' : ''} : ce téléphone a été retiré par un gérant. Montrez ce message au propriétaire.`
          : `${sales(stuck)} faite${stuck > 1 ? 's' : ''} sur ce téléphone avec ${email ? `le compte ${email}` : 'un autre compte'} : reconnectez-vous avec ce compte pour ${stuck > 1 ? 'les' : 'l’'}envoyer.`}
      </div>
    );
  }
  if (rejected > 0)
    return (
      <div role="status" className={`${base} bg-danger-strong text-white`}>
        <TriangleAlert aria-hidden className="size-5 shrink-0" />
        {rejected > 1
          ? `${rejected} opérations refusées.`
          : 'Une opération refusée.'}
        <Link
          href="/caisse"
          className="inline-flex min-h-12 items-center underline underline-offset-4 focus-visible:outline-white"
        >
          Voir pourquoi
        </Link>
      </div>
    );
  return (
    <div role="status" className={`${base} bg-brand-soft text-brand-ink`}>
      <CloudUpload aria-hidden className="size-5 shrink-0" />
      {sales(pending)} en attente d’envoi…
    </div>
  );
}
