import { fetchBinaryPublic } from '@/lib/api/server';

/** Photo of a product in a public catalogue (ADR-063). */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/b/[slug]/photo/[id]'>,
) {
  const { slug, id } = await params;
  const image = await fetchBinaryPublic(
    `/public/shops/${encodeURIComponent(slug)}/products/${encodeURIComponent(id)}/photo`,
  );
  if (!image.ok)
    return new Response(null, { status: image.status === 404 ? 404 : 502 });
  return new Response(image.data, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
