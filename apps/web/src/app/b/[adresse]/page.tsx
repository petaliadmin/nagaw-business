import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { siteUrl } from '@/lib/env';
import { getStorefront, photoUrl, storefrontLogoUrl } from '@/lib/storefront';
import { StorefrontShop } from './shop';

/** Ma vitrine (ADR-075): the page a shop shares on its status. */

export async function generateMetadata({
  params,
}: PageProps<'/b/[adresse]'>): Promise<Metadata> {
  const { adresse } = await params;
  const result = await getStorefront(adresse);
  if (!result.ok)
    return { title: 'Vitrine indisponible', robots: { index: false } };
  const shop = result.data;
  const description =
    shop.tagline ||
    `Voyez les articles de ${shop.name} et commandez. Vous payez en venant chercher.`;
  return {
    title: `${shop.name} — commandez en ligne`,
    description,
    alternates: { canonical: `/b/${shop.slug}` },
    robots: shop.indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      url: `/b/${shop.slug}`,
      title: shop.name,
      description,
    },
    twitter: { title: shop.name, description },
  };
}

async function Shop({ params }: PageProps<'/b/[adresse]'>) {
  const { adresse } = await params;
  const result = await getStorefront(adresse);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-black">
          Vitrine momentanément indisponible
        </h1>
        <p className="text-ink-muted">Réessayez dans un instant.</p>
      </main>
    );
  }
  const storefront = result.data;
  // An old address leads to the current one: a status already posted works.
  if (storefront.movedTo) permanentRedirect(`/b/${storefront.movedTo}`);
  const photos = Object.fromEntries(
    storefront.articles
      .filter((a) => a.photoVersion)
      .map((a) => [
        a.handle,
        photoUrl(storefront.slug, a.handle, a.photoVersion!),
      ]),
  );
  return (
    <StorefrontShop
      storefront={storefront}
      photos={photos}
      logo={
        storefront.logoVersion
          ? storefrontLogoUrl(storefront.slug, storefront.logoVersion)
          : null
      }
      siteUrl={siteUrl()}
    />
  );
}

export default function StorefrontPage(props: PageProps<'/b/[adresse]'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Shop {...props} />
    </Suspense>
  );
}
