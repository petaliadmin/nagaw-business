import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Lien non utilisable — Nagaw Business',
};

export default function InvalidLinkPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">
        Ce lien n’a pas pu ouvrir de session
      </h1>
      <p className="text-ink-muted">
        Si vous venez de confirmer votre adresse e-mail, elle est très
        probablement déjà validée : connectez-vous simplement avec votre mot de
        passe.
      </p>
      <p className="text-ink-muted">
        Ce message apparaît aussi lorsque le lien est ouvert dans un autre
        navigateur que celui de la demande, qu’il a déjà servi ou qu’il a
        expiré.
      </p>
      <div className="flex flex-col gap-2 text-base">
        <Link
          href="/connexion"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
        >
          Se connecter
        </Link>
        <Link
          href="/mot-de-passe-oublie"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
        >
          Demander un nouveau lien de réinitialisation
        </Link>
      </div>
    </>
  );
}
