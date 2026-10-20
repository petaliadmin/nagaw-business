import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Créer un compte — Nagaw Business' };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <SignUpForm />
      <p className="text-sm">
        Déjà inscrit ?{' '}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
