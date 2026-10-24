import { Store } from 'lucide-react';
import Link from 'next/link';

export function Logo({
  href,
  tone = 'surface',
}: {
  href: '/' | '/espace';
  tone?: 'surface' | 'sidebar';
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center gap-2 text-xl font-extrabold tracking-tight ${
        tone === 'sidebar'
          ? 'text-white focus-visible:outline-white'
          : 'text-ink'
      }`}
    >
      <span
        className={`flex size-10 items-center justify-center rounded-xl ${
          tone === 'sidebar'
            ? 'bg-white text-brand-strong'
            : 'bg-brand-strong text-white'
        }`}
      >
        <Store aria-hidden className="size-6" />
      </span>
      Nagaw Business
    </Link>
  );
}
