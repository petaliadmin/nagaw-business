import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

const LINKS = [
  ['/#tarifs', 'Tarifs'],
  ['/blog', 'Guides'],
  ['/#questions', 'Questions'],
  ['/inscription', 'Créer un compte'],
  ['/connexion', 'Se connecter'],
] as const;

/** Footer of the public pages: home page and guides. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <Logo href="/" />
          <p className="text-base text-ink-muted">
            La gestion de boutique, simple et en français.
          </p>
        </div>
        <nav aria-label="Pied de page">
          <ul className="flex flex-wrap gap-x-4">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-12 items-center font-semibold text-brand-ink underline underline-offset-4"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
