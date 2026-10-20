import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Lien invalide — Nagaw Business' };

export default function InvalidLinkPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Lien invalide ou expiré</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Ce lien ne peut plus être utilisé. Il doit être ouvert dans le
        navigateur où la demande a été faite, et une seule fois.
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
