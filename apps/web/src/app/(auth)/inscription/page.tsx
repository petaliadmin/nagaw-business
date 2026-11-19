import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button-styles';
import { AuthHeader } from '../auth-header';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Créer un compte — Nagaw Business' };

export default function SignUpPage() {
  return (
    <>
      <AuthHeader
        icon={UserPlus}
        title="Créer un compte"
        step={{ step: 1, total: 2, label: 'Votre numéro' }}
      >
        Gratuit, sans carte bancaire. Votre numéro et un code secret suffisent.
      </AuthHeader>
      <SignUpForm />
      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="text-center font-semibold text-ink-muted">
          Déjà inscrit ?
        </p>
        <Link href="/connexion" className={buttonClasses('secondary')}>
          Se connecter
        </Link>
      </div>
    </>
  );
}
