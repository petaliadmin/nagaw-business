import {
  roleHasPermission,
  showsModule,
  type CatalogSettingsDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { siteUrl } from '@/lib/env';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { CatalogSettingsForm } from './catalog-settings-form';

export const metadata: Metadata = {
  title: 'Catalogue en ligne — Nagaw Business',
};

/**
 * Settings of the public page (ADR-063), with the orders rather than in
 * Paramètres: the menu prefetches Paramètres from every page, and the
 * first visit must stay light (performance budget, Phase 17).
 */
async function CatalogSettings() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'organization.update'))
    redirect('/espace/commandes');

  if (!showsModule(organization.hiddenModules, 'orders'))
    return (
      <>
        <PageHeader title="Catalogue en ligne" />
        <Alert>
          Affichez d’abord « Commandes » dans Paramètres, carte « Menu de la
          boutique ».
        </Alert>
      </>
    );

  const settings = await apiAsUser<CatalogSettingsDto>(accessToken, {
    path: '/orders/settings',
    organizationId: organization.id,
  });
  return (
    <>
      <PageHeader
        title="Catalogue en ligne"
        description="Une page à partager sur WhatsApp et Instagram : vos clients y commandent sans compte."
      />
      <Card>
        {settings.ok ? (
          <CatalogSettingsForm
            organizationId={organization.id}
            shopName={organization.name}
            siteUrl={siteUrl()}
            settings={settings.data}
          />
        ) : (
          <Alert tone="error">
            Catalogue indisponible : {settings.message}
          </Alert>
        )}
      </Card>
    </>
  );
}

export default function CatalogSettingsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <CatalogSettings />
    </Suspense>
  );
}
