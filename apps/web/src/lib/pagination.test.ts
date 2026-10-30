import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  pageHref,
  pageNumber,
  pageParams,
  pageRows,
} from './pagination';

describe('pagination', () => {
  it('reads the page of the URL, the first one otherwise', () => {
    expect(pageNumber('3')).toBe(3);
    for (const value of [undefined, '0', '-2', '1.5', 'abc', ['2']])
      expect(pageNumber(value)).toBe(1);
  });

  it('asks one row more than it shows', () => {
    expect(pageParams(1)).toEqual({
      limit: String(PAGE_SIZE + 1),
      offset: '0',
    });
    expect(pageParams(3).offset).toBe(String(2 * PAGE_SIZE));
  });

  it('knows from that row that another page follows', () => {
    const full = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => i);
    expect(pageRows(full).hasNext).toBe(true);
    expect(pageRows(full).rows).toHaveLength(PAGE_SIZE);
    expect(pageRows(full.slice(1)).hasNext).toBe(false);
  });

  it('keeps the filters in its links', () => {
    const params = new URLSearchParams({ q: 'eau', page: '2' });
    expect(pageHref('/liste', params, 3)).toBe('/liste?q=eau&page=3');
    expect(pageHref('/liste', params, 1)).toBe('/liste?q=eau');
    expect(pageHref('/liste', new URLSearchParams(), 1)).toBe('/liste');
  });
});
