import {
  roleHasPermission,
  type StorefrontArticleSettingDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ArticlesForm } from './articles-form';

export const metadata: Metadata = {
  title: 'Articles de ma vitrine — Nagaw Business',
};

async function Articles() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'storefront.manage'))
    redirect('/espace/commandes');
  const result = await apiAsUser<StorefrontArticleSettingDto[]>(accessToken, {
    path: '/storefront/articles',
    organizationId: organization.id,
  });
  return (
    <>
      <PageHeader
        title="Articles de ma vitrine"
        description="Cochez ce que vos clients peuvent voir et commander."
      />
      {!result.ok ? (
        <Alert tone="error">Articles indisponibles : {result.message}</Alert>
      ) : result.data.length === 0 ? (
        <EmptyState title="Aucun produit pour l’instant">
          Ajoutez vos produits et services : ils pourront ensuite aller sur
          votre vitrine.
        </EmptyState>
      ) : (
        <ArticlesForm
          organizationId={organization.id}
          articles={result.data}
          currency={organization.defaultCurrency}
        />
      )}
    </>
  );
}

export default function StorefrontArticlesPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Articles />
    </Suspense>
  );
}
