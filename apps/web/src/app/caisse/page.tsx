import type { Metadata } from 'next';
import { CaisseApp } from './caisse-app';

export const metadata: Metadata = { title: 'Caisse — Nagaw Business' };

/**
 * Static shell of the checkout: it holds no user data, so the service
 * worker can keep it and open it without network. The data come from the
 * device's local copy, refreshed whenever the network allows (ADR-020).
 */
export default function CaissePage() {
  return <CaisseApp />;
}
