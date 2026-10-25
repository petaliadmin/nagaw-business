import 'server-only';
import { fetchBinaryAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/**
 * CSV export fetched from the API with the user's token and active shop;
 * the API checks the permission.
 */
export async function csvDownload(
  path: string,
  name: string,
): Promise<Response> {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready') return new Response(null, { status: 404 });
  const file = await fetchBinaryAsUser(
    workspace.accessToken,
    path,
    workspace.organization.id,
  );
  if (!file.ok)
    return new Response(
      file.status === 403
        ? 'Votre rôle ne donne pas accès à la comptabilité.'
        : 'Export indisponible, réessayez.',
      {
        status: file.status === 403 ? 403 : 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      },
    );
  return new Response(file.data, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
