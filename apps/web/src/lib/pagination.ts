/** Rows on a page of a list (ADR-044). */
export const PAGE_SIZE = 20;

/** The page asked in the URL (`?page=3`), the first one when it makes no sense. */
export function pageNumber(value: string | string[] | undefined): number {
  const page = typeof value === 'string' ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/**
 * API parameters of a page. One row more than shown: its presence tells
 * that a next page exists, without counting the whole list.
 */
export function pageParams(page: number): { limit: string; offset: string } {
  return {
    limit: String(PAGE_SIZE + 1),
    offset: String((page - 1) * PAGE_SIZE),
  };
}

/** The rows to show out of what the API answered, and whether more follow. */
export function pageRows<T>(rows: readonly T[]): {
  rows: T[];
  hasNext: boolean;
} {
  return { rows: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE };
}

/** The same address on another page, with its filters. */
export function pageHref(
  path: string,
  params: URLSearchParams,
  page: number,
): string {
  const next = new URLSearchParams(params);
  next.delete('page');
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
