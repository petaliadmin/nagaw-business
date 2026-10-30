import { SHOP_MARKS, type ShopMarkKind } from '@nagaw/shared';
import { fetchBinaryAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/**
 * Signature or stamp on the web origin, for the preview in the settings:
 * the API only gives them to those who manage them (ADR-052).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/espace/parametres/image/[kind]'>,
) {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready') return new Response(null, { status: 404 });
  const { kind } = await params;
  if (!SHOP_MARKS.includes(kind as ShopMarkKind))
    return new Response(null, { status: 404 });
  const image = await fetchBinaryAsUser(
    workspace.accessToken,
    `/organizations/current/marks/${kind}`,
    workspace.organization.id,
  );
  if (!image.ok)
    return new Response(null, { status: image.status === 404 ? 404 : 502 });
  return new Response(image.data, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
