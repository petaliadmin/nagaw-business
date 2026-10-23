/**
 * Public URL of this site. `SITE_URL` wins; on Vercel previews, where it is
 * not set, the stable branch URL keeps links (invitations, e-mail
 * confirmation) pointing at the preview rather than at localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>) {
  const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  const url =
    env.SITE_URL || (host ? `https://${host}` : 'http://localhost:3000');
  return url.replace(/\/+$/, '');
}
