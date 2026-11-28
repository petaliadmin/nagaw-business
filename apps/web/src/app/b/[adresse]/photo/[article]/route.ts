import { fetchPublicBinary } from '@/lib/api/server';

/** The photo of an article of a storefront (ADR-075), public. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ adresse: string; article: string }> },
) {
  const { adresse, article } = await params;
  const photo = await fetchPublicBinary(
    `/public/storefronts/${encodeURIComponent(adresse)}/articles/${encodeURIComponent(article)}/photo`,
  );
  if (!photo.ok)
    return new Response(null, { status: photo.status === 404 ? 404 : 502 });
  return new Response(photo.data, {
    headers: {
      'Content-Type': photo.contentType,
      // The address carries the version: a new photo is a new address.
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
