import {
  invitationTokenSchema,
  type InvitationPreviewDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { getSession, apiAsUser } from '@/lib/api/server';
import { ROLE_LABELS } from '@/lib/labels';
import { signOut } from '../actions';
import { AcceptInvitationForm } from './accept-invitation-form';

export const metadata: Metadata = {
  title: 'Invitation — Nagaw Business',
  // The token is in the URL: never send it to another site.
  referrer: 'no-referrer',
};

const STATUS_MESSAGES = {
  accepted: 'Cette invitation a déjà été acceptée.',
  revoked: 'Cette invitation a été annulée par la boutique.',
  expired:
    'Cette invitation a expiré. Demandez à la boutique de vous en envoyer une nouvelle.',
} as const;

function Title() {
  return <h1 className="text-3xl font-extrabold">Invitation</h1>;
}

async function Invitation({ searchParams }: PageProps<'/invitation'>) {
  // Request-time only: the session and the invitation are per visitor.
  await connection();
  const raw = (await searchParams).jeton;
  const token = invitationTokenSchema.safeParse(raw);
  if (!token.success) {
    return (
      <>
        <Title />
        <Alert tone="error">
          Ce lien d’invitation est incomplet ou invalide. Vérifiez que vous
          l’avez copié en entier.
        </Alert>
      </>
    );
  }

  const here = `/invitation?jeton=${token.data}`;
  const session = await getSession();
  if (session.status === 'not-configured') {
    return (
      <>
        <Title />
        <Alert tone="error">
          L’authentification n’est pas encore configurée sur cet environnement.
        </Alert>
      </>
    );
  }
  if (session.status === 'signed-out') {
    const next = encodeURIComponent(here);
    return (
      <>
        <Title />
        <p className="text-ink-muted">
          Vous avez été invité à rejoindre une boutique sur Nagaw Business.
          Connectez-vous, ou créez un compte avec l’adresse e-mail qui a reçu
          l’invitation.
        </p>
        <div className="flex flex-col gap-2 text-base">
          <Link
            href={`/connexion?next=${next}`}
            className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
          >
            Se connecter pour accepter
          </Link>
          <Link
            href={`/inscription?next=${next}`}
            className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
          >
            Créer un compte
          </Link>
        </div>
      </>
    );
  }

  const preview = await apiAsUser<InvitationPreviewDto>(session.accessToken, {
    method: 'POST',
    path: '/invitations/preview',
    body: { token: token.data },
  });
  if (!preview.ok) {
    return (
      <>
        <Title />
        <Alert tone="error">
          {preview.status === 404
            ? 'Cette invitation n’existe pas ou n’est plus valable.'
            : `Invitation indisponible : ${preview.message}`}
        </Alert>
        <Link
          href="/espace"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
        >
          Aller à mon espace
        </Link>
      </>
    );
  }

  const invitation = preview.data;
  const heading = (
    <>
      <Title />
      <p>
        Vous êtes invité à rejoindre{' '}
        <strong>{invitation.organizationName}</strong> en tant que{' '}
        {ROLE_LABELS[invitation.role].toLowerCase()}.
      </p>
    </>
  );

  if (invitation.status !== 'pending') {
    return (
      <>
        {heading}
        <Alert tone="error">{STATUS_MESSAGES[invitation.status]}</Alert>
        <Link
          href="/espace"
          className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
        >
          Aller à mon espace
        </Link>
      </>
    );
  }

  if (!invitation.emailMatches) {
    return (
      <>
        {heading}
        <Alert tone="error">
          Cette invitation est destinée à {invitation.email}, mais vous êtes
          connecté avec {session.email ?? 'une autre adresse'}.
        </Alert>
        <form action={signOut}>
          <input type="hidden" name="next" value={here} />
          <button
            type="submit"
            className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
          >
            Se déconnecter pour changer de compte
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      {heading}
      <AcceptInvitationForm token={token.data} />
    </>
  );
}

export default function InvitationPage(props: PageProps<'/invitation'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-ink-muted">
          Chargement de l’invitation…
        </p>
      }
    >
      <Invitation {...props} />
    </Suspense>
  );
}
