import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Connexion — Nagaw Business' };

const LINK =
  'inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4';

export default function SignInPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Connexion</h1>
      <SignInForm />
      <div className="flex flex-col gap-2 text-base">
        <Link href="/code-oublie" className={LINK}>
          Code secret oublié ?
        </Link>
        <p>
          Pas encore de compte ?{' '}
          <Link
            href="/inscription"
            className="font-bold text-brand-ink underline underline-offset-4"
          >
            Créer un compte
          </Link>
        </p>
        <Link href="/connexion/email" className={LINK}>
          J’ai un ancien compte avec une adresse e-mail
        </Link>
      </div>
    </>
  );
}
