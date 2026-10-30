import type { PageQuery } from '@nagaw/shared';

/**
 * One page of a list, or the whole list up to `cap` without paging. The
 * query must end its ordering on a unique column: a page must not repeat a
 * row of the one before.
 */
export function pageOf<Q extends { limit(n: number): Q; offset(n: number): Q }>(
  rows: Q,
  page: PageQuery,
  cap: number,
): Q {
  return rows.limit(page.limit ?? cap).offset(page.offset ?? 0);
}
