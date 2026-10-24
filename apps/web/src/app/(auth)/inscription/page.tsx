import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Créer un compte — Nagaw Business' };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Créer un compte</h1>
      <SignUpForm />
      <p className="text-base">
        Déjà inscrit ?{' '}
        <Link
          href="/connexion"
          className="font-bold text-brand-ink underline underline-offset-4"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
