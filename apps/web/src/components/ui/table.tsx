import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

/**
 * Accessible data table that scrolls horizontally on narrow screens
 * instead of overflowing the page.
 */
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    // Focusable and named, so keyboard users can scroll it (WCAG 2.1.1).
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="relative overflow-x-auto rounded-2xl border border-line bg-surface"
    >
      <table className="w-full min-w-[32rem] text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className="px-4 py-3 font-semibold"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.header} className="px-4 py-3 align-top">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
