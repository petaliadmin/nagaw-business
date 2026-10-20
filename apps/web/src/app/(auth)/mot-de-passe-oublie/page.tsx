import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetRequestForm } from './reset-request-form';

export const metadata: Metadata = {
  title: 'Mot de passe oublié — Nagaw Business',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation.
      </p>
      <ResetRequestForm />
      <Link href="/connexion" className="text-sm underline">
        Retour à la connexion
      </Link>
    </>
  );
}
