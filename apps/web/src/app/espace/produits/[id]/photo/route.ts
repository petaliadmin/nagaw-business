import { fetchBinaryAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/**
 * Product photo on the web origin, so that <img> can show it: fetched from
 * the API with the user's token and active shop, never publicly. The URL
 * carries the photo version, so the browser may keep it.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/espace/produits/[id]/photo'>,
) {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready') return new Response(null, { status: 404 });
  const { id } = await params;
  const photo = await fetchBinaryAsUser(
    workspace.accessToken,
    `/products/${encodeURIComponent(id)}/photo`,
    workspace.organization.id,
  );
  if (!photo.ok)
    return new Response(null, { status: photo.status === 404 ? 404 : 502 });
  return new Response(photo.data, {
    headers: {
      'Content-Type': photo.contentType,
      'Cache-Control': 'private, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
