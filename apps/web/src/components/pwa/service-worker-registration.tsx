'use client';

import { useEffect } from 'react';

/**
 * Registers `/sw.js` in production builds only: in development the worker
 * would serve stale assets and hide changes.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => {
        // The app still works online; only the offline page is missing.
        console.error('Enregistrement du service worker impossible', error);
      });
  }, []);
  return null;
}
