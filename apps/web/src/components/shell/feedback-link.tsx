'use client';

import { MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** « Donner mon avis », remembering the page the person was on. */
export function FeedbackLink({
  tone,
  pill = false,
}: {
  tone: 'sidebar' | 'surface';
  /** A round button, side by side with « Se déconnecter » (V3 Menu). */
  pill?: boolean;
}) {
  const pathname = usePathname();
  const from = pathname.startsWith('/espace/avis') ? '' : pathname;
  return (
    <Link
      href={
        from
          ? `/espace/avis?depuis=${encodeURIComponent(from)}`
          : '/espace/avis'
      }
      className={
        pill
          ? 'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-surface px-3 text-base font-bold whitespace-nowrap text-ink'
          : `inline-flex min-h-12 items-center gap-2 font-semibold underline underline-offset-4 ${
              tone === 'sidebar'
                ? 'text-white focus-visible:outline-white'
                : 'text-brand-ink'
            }`
      }
    >
      <MessageSquareText aria-hidden className="size-5" />
      Donner mon avis
    </Link>
  );
}
