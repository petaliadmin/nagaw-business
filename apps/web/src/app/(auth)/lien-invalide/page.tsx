import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Lien non utilisable — Nagaw Business',
};

export default function InvalidLinkPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">
        Ce lien n’a pas pu ouvrir de session
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Si vous venez de confirmer votre adresse e-mail, elle est très
        probablement déjà validée : connectez-vous simplement avec votre mot de
        passe.
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Ce message apparaît aussi lorsque le lien est ouvert dans un autre
        navigateur que celui de la demande, qu’il a déjà servi ou qu’il a
        expiré.
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
        <Link href="/mot-de-passe-oublie" className="underline">
          Demander un nouveau lien de réinitialisation
        </Link>
      </div>
    </>
  );
}
