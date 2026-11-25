import { historyLabel } from '@nagaw/shared';
import Link from 'next/link';

/**
 * Said above a list when the shop's offer shows only part of its history
 * (ADR-075); nothing when it shows all of it.
 */
export function HistoryNote({ months }: { months: number | null }) {
  if (months === null) return null;
  return (
    <p className="text-ink-muted">
      Votre offre affiche l’historique sur {historyLabel(months)}. Rien n’est
      effacé :{' '}
      <Link
        href="/espace/abonnement"
        className="font-semibold text-brand-ink underline underline-offset-4"
      >
        une autre offre montre tout
      </Link>
      .
    </p>
  );
}
