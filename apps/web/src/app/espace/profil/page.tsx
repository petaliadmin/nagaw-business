import { roleHasPermission, type ShopProfileDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { skipProfile } from './actions';
import { ProfileQuestionnaire } from './profile-questionnaire';

export const metadata: Metadata = {
  title: 'Votre activité — Nagaw Business',
};

async function Questionnaire() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  // The owner and the managers shape the menu; the API refuses the others.
  if (!roleHasPermission(organization.role, 'organization.update'))
    redirect('/espace');

  const profile = await apiAsUser<ShopProfileDto>(accessToken, {
    path: '/organizations/current/profile',
    organizationId: organization.id,
  });

  return (
    <>
      <PageHeader
        title="Votre activité"
        description="Quelques questions pour n’afficher que ce qui vous sert. Deux minutes, et tout se change ensuite dans Paramètres."
      />
      <Card>
        {profile.ok ? (
          <ProfileQuestionnaire
            organizationId={organization.id}
            profile={profile.data}
          />
        ) : (
          <Alert tone="error">
            Questions indisponibles : {profile.message}
          </Alert>
        )}
      </Card>
      {organization.profileStatus === 'pending' && (
        <form action={skipProfile} className="self-center">
          <input type="hidden" name="organizationId" value={organization.id} />
          <button type="submit" className={buttonClasses('secondary')}>
            Plus tard
          </button>
        </form>
      )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Questionnaire />
    </Suspense>
  );
}
