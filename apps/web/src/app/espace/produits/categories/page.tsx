import type { CategoryDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { CATEGORY_COLOR_LABELS, CATEGORY_TONES } from '@/lib/catalog/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ReferenceList } from '../reference-page';

export const metadata: Metadata = { title: 'Catégories — Nagaw Business' };

async function Categories() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const categories = await apiAsUser<CategoryDto[]>(workspace.accessToken, {
    path: '/product-categories',
    organizationId: workspace.organization.id,
  });
  return (
    <>
      <PageHeader
        title="Catégories"
        description="Rangez vos produits (boissons, hygiène, alimentation…) pour les retrouver vite."
      />
      <ReferenceList
        kind="category"
        workspace={workspace}
        items={categories}
        addTitle="Ajouter une catégorie"
        addLabel="Ajouter la catégorie"
        emptyTitle="Aucune catégorie pour le moment"
        listLabel="Catégories"
        describe={(category) => (
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-0.5 font-semibold ${CATEGORY_TONES[category.color]}`}
            >
              {CATEGORY_COLOR_LABELS[category.color]}
            </span>
            {category.productCount} produit
            {category.productCount > 1 ? 's' : ''}
          </span>
        )}
      />
    </>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Categories />
    </Suspense>
  );
}
