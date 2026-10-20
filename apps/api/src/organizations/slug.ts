import { randomBytes } from 'node:crypto';

/**
 * URL-safe slug from an organization name plus a random suffix, so two
 * companies with the same name never collide or reveal each other.
 */
export function generateSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  return base.length >= 2 ? `${base}-${suffix}` : `org-${suffix}`;
}
