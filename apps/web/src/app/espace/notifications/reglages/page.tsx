import type { NotificationPreferenceDto, PushConfigDto } from '@nagaw/shared';
import { BellRing, ListChecks } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { PreferencesForm } from './preferences-form';
import { PushSwitch } from './push-switch';

export const metadata: Metadata = {
  title: 'Ce que je reçois — Nagaw Business',
};

async function Settings() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const [preferences, push] = await Promise.all([
    apiAsUser<NotificationPreferenceDto[]>(accessToken, {
      path: '/notifications/preferences',
      organizationId: organization.id,
    }),
    apiAsUser<PushConfigDto>(accessToken, { path: '/push/config' }),
  ]);
  return (
    <>
      <PageHeader
        title="Ce que je reçois"
        description={`Vos choix pour la boutique ${organization.name}. Chacun choisit pour lui-même.`}
        actions={
          <ButtonLink href="/espace/notifications" variant="secondary">
            Revenir aux notifications
          </ButtonLink>
        }
      />
      <Card title="Sur ce téléphone" titleId="push" icon={BellRing}>
        {!push.ok ? (
          <Alert tone="error">Réglage indisponible : {push.message}</Alert>
        ) : (
          <PushSwitch publicKey={push.data.publicKey} />
        )}
      </Card>
      <Card title="Les sujets" titleId="topics" icon={ListChecks}>
        {!preferences.ok ? (
          <Alert tone="error">
            Vos choix sont indisponibles : {preferences.message}
          </Alert>
        ) : (
          <PreferencesForm
            organizationId={organization.id}
            preferences={preferences.data}
          />
        )}
      </Card>
    </>
  );
}

export default function NotificationSettingsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Settings />
    </Suspense>
  );
}
