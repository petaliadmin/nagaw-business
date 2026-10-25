import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

/**
 * « Vendre » floating over the page, always within reach of the thumb:
 * above the phone bottom bar (73 px and the safe area), under the « Plus »
 * sheet (z-40). With its word, not an icon alone (DESIGN.md). The page
 * keeps room under its last block so that the button never hides it.
 */
export function SellFab() {
  return (
    <>
      <div aria-hidden className="h-20 shrink-0 md:h-12 print:hidden" />
      <Link
        href="/caisse"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-sales-strong px-7 text-xl font-bold text-white shadow-lg transition-shadow hover:shadow-xl md:right-8 md:bottom-8 print:hidden"
      >
        <ShoppingCart aria-hidden className="size-6" />
        Vendre
      </Link>
    </>
  );
}
