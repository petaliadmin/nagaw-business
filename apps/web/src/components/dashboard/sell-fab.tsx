import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

/**
 * « Vendre » floating over Accueil and Ventes on a tablet or a computer.
 * On a phone it is in the middle of the bottom bar (ADR-062), so nothing
 * floats over the page there. With its word, not an icon alone (DESIGN.md).
 * The page keeps room under its last block so that the button never hides it.
 */
export function SellFab() {
  return (
    <>
      <div aria-hidden className="hidden h-12 shrink-0 md:block print:hidden" />
      <Link
        href="/caisse"
        prefetch={false}
        className="fixed right-8 bottom-8 z-20 hidden min-h-16 items-center justify-center gap-2 rounded-full bg-sales-strong px-7 text-xl font-bold text-white shadow-lg transition-shadow hover:shadow-xl md:inline-flex print:hidden"
      >
        <ShoppingCart aria-hidden className="size-6" />
        Vendre
      </Link>
    </>
  );
}
