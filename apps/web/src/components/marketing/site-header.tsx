import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button-link';
import { Logo } from '@/components/ui/logo';

const LINKS = [
  ['/#fonctions', 'Fonctions'],
  ['/#tarifs', 'Tarifs'],
  ['/blog', 'Guides'],
  ['/#questions', 'Questions'],
] as const;

/** Header of the public pages: home page and guides. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Logo href="/" />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex gap-1">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-12 items-center px-3 font-bold text-ink underline-offset-4 hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ButtonLink href="/connexion" variant="secondary" className="px-4">
          Se connecter
        </ButtonLink>
      </div>
    </header>
  );
}
