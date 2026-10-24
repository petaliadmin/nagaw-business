import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetRequestForm } from './reset-request-form';

export const metadata: Metadata = {
  title: 'Mot de passe oublié — Nagaw Business',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Mot de passe oublié</h1>
      <p className="text-ink-muted">
        Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation.
      </p>
      <ResetRequestForm />
      <Link
        href="/connexion"
        className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
      >
        Retour à la connexion
      </Link>
    </>
  );
}
