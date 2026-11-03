import type { Metadata } from 'next';
import Link from 'next/link';
import { EmailSignInForm } from './email-sign-in-form';

export const metadata: Metadata = {
  title: 'Connexion avec une adresse e-mail — Nagaw Business',
};

/**
 * Accounts opened before ADR-058. After this sign-in, the account is
 * offered to move to a phone number and a secret code.
 */
export default function EmailSignInPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Ancien compte</h1>
      <p className="text-ink-muted">
        Votre compte a été créé avec une adresse e-mail ? Connectez-vous une
        dernière fois avec elle. Ensuite, vous pourrez choisir votre numéro de
        téléphone et un code secret.
      </p>
      <EmailSignInForm />
      <div className="flex flex-col gap-2 text-base">
        <Link
          href="/mot-de-passe-oublie"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
        >
          Mot de passe oublié ?
        </Link>
        <Link
          href="/connexion"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
        >
          Se connecter avec un numéro de téléphone
        </Link>
      </div>
    </>
  );
}
