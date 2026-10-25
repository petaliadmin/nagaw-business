import { fetchBinaryAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/**
 * Receipt photo on the web origin, so that <img> can show it: fetched from
 * the API with the user's token and active shop, never publicly.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/espace/tresorerie/depenses/[id]/justificatif'>,
) {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready') return new Response(null, { status: 404 });
  const { id } = await params;
  const receipt = await fetchBinaryAsUser(
    workspace.accessToken,
    `/expenses/${encodeURIComponent(id)}/receipt`,
    workspace.organization.id,
  );
  if (!receipt.ok)
    return new Response(null, { status: receipt.status === 404 ? 404 : 502 });
  return new Response(receipt.data, {
    headers: {
      'Content-Type': receipt.contentType,
      'Cache-Control': 'private, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
