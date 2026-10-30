import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button-styles';
import { pageHref } from '@/lib/pagination';

/**
 * « Précédent », the page, « Suivant », under a list. Nothing when the list
 * fits on one page.
 */
export function Pagination({
  path,
  params,
  page,
  hasNext,
}: {
  path: string;
  /** Filters of the list, kept from page to page. */
  params: URLSearchParams;
  page: number;
  hasNext: boolean;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav
      aria-label="Pages de la liste"
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
    >
      {page > 1 ? (
        <Link
          href={pageHref(path, params, page - 1)}
          rel="prev"
          className={buttonClasses('secondary', 'justify-self-start px-3')}
        >
          <ChevronLeft aria-hidden className="size-5 shrink-0" />
          Précédent
        </Link>
      ) : (
        <span />
      )}
      <span aria-current="page" className="font-bold tabular-nums">
        Page {page}
      </span>
      {hasNext ? (
        <Link
          href={pageHref(path, params, page + 1)}
          rel="next"
          className={buttonClasses('secondary', 'justify-self-end px-3')}
        >
          Suivant
          <ChevronRight aria-hidden className="size-5 shrink-0" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
