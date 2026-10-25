import { fetchBinaryAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/** Quote PDF on the web origin, fetched with the user's token and shop. */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/espace/factures/devis/[id]/pdf'>,
) {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready') return new Response(null, { status: 404 });
  const { id } = await params;
  const pdf = await fetchBinaryAsUser(
    workspace.accessToken,
    `/quotes/${encodeURIComponent(id)}/pdf`,
    workspace.organization.id,
  );
  if (!pdf.ok)
    return new Response(null, { status: pdf.status === 404 ? 404 : 502 });
  return new Response(pdf.data, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
