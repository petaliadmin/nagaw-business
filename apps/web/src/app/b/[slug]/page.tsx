import type { PublicCatalogDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiPublic } from '@/lib/api/server';
import { ShopCatalog } from './shop-catalog';

// A shop's page is shared by the shop, not found through a search engine:
// it stays out of the indexes until its owner decides otherwise.
export const metadata: Metadata = {
  title: 'Catalogue — Nagaw Business',
  robots: { index: false, follow: false },
};

async function Catalog({ params }: PageProps<'/b/[slug]'>) {
  const { slug } = await params;
  const catalog = await apiPublic<PublicCatalogDto>(
    `/public/shops/${encodeURIComponent(slug)}`,
  );
  if (!catalog.ok && catalog.status === 404) notFound();
  if (!catalog.ok)
    return (
      <Alert tone="error">
        Le catalogue ne répond pas pour l’instant. Réessayez dans un moment.
      </Alert>
    );
  return <ShopCatalog catalog={catalog.data} />;
}

/** Public catalogue of a shop, opened from a link (ADR-063). */
export default function PublicCatalogPage(props: PageProps<'/b/[slug]'>) {
  return (
    <main
      id="contenu"
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 bg-canvas px-4 pt-6 pb-40"
    >
      <Suspense fallback={<PageFallback />}>
        <Catalog {...props} />
      </Suspense>
    </main>
  );
}
