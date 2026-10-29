/** Canonical address of the production site: sitemap, robots, llms.txt. */
export const PRODUCTION_SITE_URL = 'https://www.naagaw.com';

/**
 * Public URL of this site. In production it is always the canonical
 * domain, so that a stale `SITE_URL` (a *.vercel.app address) never leaks
 * into the sitemap or the links. Elsewhere `SITE_URL` wins; on Vercel
 * previews, where it is not set, the stable branch URL keeps links
 * (invitations, e-mail confirmation) pointing at the preview rather than
 * at localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>) {
  if (env.VERCEL_ENV === 'production') return PRODUCTION_SITE_URL;
  const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  const url =
    env.SITE_URL || (host ? `https://${host}` : 'http://localhost:3000');
  return url.replace(/\/+$/, '');
}
