import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button-styles';
import { CONTACT_PHONE, CONTACT_PHONE_LINK } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Code secret oublié — Nagaw Business',
};

/**
 * No SMS is sent (ADR-058): the team checks who is calling, then gives a
 * new code from the administration.
 */
export default function ForgottenPinPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Code secret oublié</h1>
      <p>
        Appelez l’équipe Nagaw ou écrivez-lui sur WhatsApp, depuis le numéro de
        votre compte. Après avoir vérifié que c’est bien vous, elle vous donne
        un nouveau code secret.
      </p>
      <a href={CONTACT_PHONE_LINK} className={buttonClasses('primary')}>
        Appeler le {CONTACT_PHONE}
      </a>
      <p className="text-ink-muted">
        Après plusieurs codes faux, le numéro est bloqué quelques minutes. Un
        nouveau code donné par l’équipe le débloque aussitôt.
      </p>
      <Link
        href="/connexion"
        className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
      >
        Retour à la connexion
      </Link>
    </>
  );
}
