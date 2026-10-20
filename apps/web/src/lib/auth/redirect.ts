/**
 * Returns a safe in-app path for post-authentication redirects, rejecting
 * absolute and protocol-relative URLs (open redirect protection).
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = '/espace',
): string {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.startsWith('/\\')
  ) {
    return fallback;
  }
  return next;
}
