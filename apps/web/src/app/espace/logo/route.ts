import { fetchBinaryAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/**
 * Logo of the active shop on the web origin, so that <img> can show it:
 * fetched from the API with the user's token, never publicly. The URL
 * carries the logo version, so the browser may keep it.
 */
export async function GET() {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready') return new Response(null, { status: 404 });
  const logo = await fetchBinaryAsUser(
    workspace.accessToken,
    '/organizations/current/logo',
    workspace.organization.id,
  );
  if (!logo.ok)
    return new Response(null, { status: logo.status === 404 ? 404 : 502 });
  return new Response(logo.data, {
    headers: {
      'Content-Type': logo.contentType,
      'Cache-Control': 'private, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
