import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { buttonClasses } from '@/components/ui/button-styles';
import { knownPhone } from '@/lib/auth/known-phone';
import { LockKeyhole, Smartphone } from 'lucide-react';
import { AuthHeader } from '../auth-header';
import { KnownPhoneSignInForm, SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Connexion — Nagaw Business' };

const LINK =
  'inline-flex min-h-12 items-center self-center font-bold text-brand-ink underline underline-offset-4';

/** Only the code when this device already knows the number (ADR-059). */
async function SignIn() {
  const phone = await knownPhone();
  if (phone) {
    return (
      <>
        <AuthHeader icon={LockKeyhole} title="Bon retour">
          Tapez votre code secret.
        </AuthHeader>
        <KnownPhoneSignInForm phone={phone} />
        <Link href="/code-oublie" className={LINK}>
          Code secret oublié ?
        </Link>
      </>
    );
  }
  return (
    <>
      <AuthHeader icon={Smartphone} title="Connexion">
        Votre numéro et votre code secret.
      </AuthHeader>
      <SignInForm />
      <Link href="/code-oublie" className={LINK}>
        Code secret oublié ?
      </Link>
      {/* The e-mail accounts of before ADR-058 still sign in at
          /connexion/email, a link the team gives them: no more on this
          page (ADR-064). */}
      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="text-center font-semibold text-ink-muted">
          Pas encore de compte ?
        </p>
        <Link href="/inscription" className={buttonClasses('secondary')}>
          Créer un compte
        </Link>
      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<PageFallback variant="form" />}>
      <SignIn />
    </Suspense>
  );
}
