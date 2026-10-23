/**
 * Every entry points to a page that exists. Modules from later phases are
 * added here only when their page ships (no dead links).
 */
export const NAV_ITEMS = [
  { href: '/espace', label: 'Vue d’ensemble' },
  { href: '/espace/equipe', label: 'Équipe' },
  { href: '/espace/journal', label: 'Journal d’audit' },
  { href: '/espace/parametres', label: 'Paramètres' },
] as const;

/** Exact match for the overview, prefix match for sections. */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/espace') return pathname === '/espace';
  return pathname === href || pathname.startsWith(`${href}/`);
}
