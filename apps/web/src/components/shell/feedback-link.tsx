'use client';

import { MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** « Donner mon avis », remembering the page the person was on. */
export function FeedbackLink({ tone }: { tone: 'sidebar' | 'surface' }) {
  const pathname = usePathname();
  const from = pathname.startsWith('/espace/avis') ? '' : pathname;
  return (
    <Link
      href={
        from
          ? `/espace/avis?depuis=${encodeURIComponent(from)}`
          : '/espace/avis'
      }
      className={`inline-flex min-h-12 items-center gap-2 font-semibold underline underline-offset-4 ${
        tone === 'sidebar'
          ? 'text-white focus-visible:outline-white'
          : 'text-brand-ink'
      }`}
    >
      <MessageSquareText aria-hidden className="size-5" />
      Donner mon avis
    </Link>
  );
}
