import type { ReactNode } from 'react';

/**
 * Horizontal scroll area for a wide table on a phone: focusable and named,
 * so that keyboard users can scroll it too (WCAG 2.1.1), like `Table`.
 */
export function ScrollRegion({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`overflow-x-auto ${className}`}
    >
      {children}
    </div>
  );
}
