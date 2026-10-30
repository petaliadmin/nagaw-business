'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { canGoBack, parentPath, trackPath } from './navigation';

/** Pages seen in this tab; a reload starts again from the page above. */
let trail: string[] = [];

/** Follows the pages seen: once in each frame of the application. */
export function NavigationTrail() {
  const pathname = usePathname();
  useEffect(() => {
    trail = trackPath(trail, pathname);
  }, [pathname]);
  return null;
}

/**
 * The one « Retour » of the application: back to the page just seen, with
 * its filters and its scroll; without one, or when it was a form already
 * sent, to the page above. Nothing on the pages of the menu (ADR-050).
 */
export function BackLink({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const parent = parentPath(pathname);
  if (!parent) return null;
  return (
    <Link
      href={parent}
      onClick={(event) => {
        const newTab = event.metaKey || event.ctrlKey || event.shiftKey;
        if (newTab || !canGoBack(trail)) return;
        event.preventDefault();
        router.back();
      }}
      className={`min-h-12 shrink-0 items-center gap-0.5 rounded-xl pr-2 text-base font-bold text-brand-ink print:hidden ${className}`}
    >
      <ChevronLeft aria-hidden className="size-7" />
      Retour
    </Link>
  );
}
