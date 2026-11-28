import { fetchPublicBinary } from '@/lib/api/server';

/** The logo of a storefront (ADR-075), public. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ adresse: string }> },
) {
  const { adresse } = await params;
  const logo = await fetchPublicBinary(
    `/public/storefronts/${encodeURIComponent(adresse)}/logo`,
  );
  if (!logo.ok)
    return new Response(null, { status: logo.status === 404 ? 404 : 502 });
  return new Response(logo.data, {
    headers: {
      'Content-Type': logo.contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
