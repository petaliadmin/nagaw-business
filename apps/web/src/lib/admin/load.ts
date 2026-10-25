import 'server-only';
import { loadWorkspace } from '../workspace/load';

/**
 * The signed-in platform administrator (ADR-030), or null. The API checks
 * it again on every admin call: this only decides what the page shows.
 */
export async function requirePlatformAdmin() {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready' && workspace.status !== 'no-organization')
    return null;
  if (!workspace.me.platformAdmin) return null;
  return { me: workspace.me, accessToken: workspace.accessToken };
}
