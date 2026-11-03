import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { getSession } from '@/lib/api/server';
import { safeNextPath } from '@/lib/auth/redirect';
import { LinkPhoneForm } from './link-phone-form';
import { LaterLink } from './later-link';

export const metadata: Metadata = {
  title: 'Passer au numéro de téléphone — Nagaw Business',
};

/**
 * Offered after each sign-in with an e-mail (ADR-058): the account takes a
 * number and a secret code, and signs in with them from then on.
 */
async function Offer({ searchParams }: PageProps<'/mon-numero'>) {
  await connection();
  const next = safeNextPath((await searchParams).next?.toString());
  const session = await getSession();
  if (session.status === 'not-configured') {
    return (
      <Alert tone="error">
        L’authentification n’est pas encore configurée sur cet environnement.
      </Alert>
    );
  }
  if (session.status === 'signed-out') {
    redirect(`/connexion/email?next=${encodeURIComponent('/mon-numero')}`);
  }
  if (session.phone) redirect(next);
  return (
    <>
      <p>
        Nagaw Business se connecte maintenant avec un{' '}
        <strong>numéro de téléphone</strong> et un{' '}
        <strong>code secret de 4 chiffres</strong>, plus simples qu’une adresse
        e-mail et un mot de passe. Votre boutique et vos ventes restent les
        mêmes.
      </p>
      <LinkPhoneForm />
      <LaterLink next={next} />
    </>
  );
}

export default function LinkPhonePage(props: PageProps<'/mon-numero'>) {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Passer au numéro de téléphone</h1>
      <Suspense
        fallback={
          <p role="status" className="text-ink-muted">
            Chargement…
          </p>
        }
      >
        <Offer {...props} />
      </Suspense>
    </>
  );
}
