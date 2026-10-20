import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Connexion — Nagaw Business' };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <SignInForm />
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/mot-de-passe-oublie" className="underline">
          Mot de passe oublié ?
        </Link>
        <p>
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </>
  );
}
