'use client';

import { formatAmount, formatCompactAmount } from '@nagaw/shared';
import { useLayoutEffect, useRef, useState } from 'react';

let canvas: HTMLCanvasElement | null = null;

function textWidth(element: Element, text: string): number {
  canvas ??= document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  const style = getComputedStyle(element);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

/** Width of the longest word of an element: below it, words get cut. */
function longestWord(element: HTMLElement): number {
  const first = element.firstElementChild ?? element;
  return Math.max(
    0,
    ...(element.textContent ?? '')
      .split(/\s+/)
      .map((word) => textWidth(first, word)),
  );
}

/**
 * An amount on one line, shortened as people say it — `9,99 Md F CFA` —
 * only when the full amount does not fit (ADR-065):
 * - `row`: it would leave the name beside it (the element just before)
 *   too narrow for its words, so that « Ticket n° 000902 » never breaks
 *   letter by letter;
 * - `box`: it would be wider than its place (a narrow tile).
 * The full amount stays in its title and for screen readers.
 */
export function InlineAmount({
  minor,
  currency,
  fit = 'row',
  className = '',
}: {
  minor: number;
  currency: string;
  fit?: 'row' | 'box';
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);
  const full = formatAmount(minor, currency);
  const compact = formatCompactAmount(minor, currency);

  useLayoutEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent || compact === full) return;
    const check = () => {
      const fullWidth = textWidth(element, full);
      if (fit === 'box') {
        if (parent.clientWidth > 0) setShort(fullWidth > parent.clientWidth);
        return;
      }
      const name = element.previousElementSibling;
      if (!(name instanceof HTMLElement)) return;
      // The room the name would have with the full amount shown.
      const room = name.clientWidth + element.offsetWidth - fullWidth;
      setShort(room < longestWord(name));
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [full, compact, fit]);

  return (
    <span
      ref={ref}
      title={short ? full : undefined}
      className={`whitespace-nowrap tabular-nums ${fit === 'row' ? 'shrink-0' : 'block max-w-full'} ${className}`}
    >
      {short ? (
        <>
          <span aria-hidden>{compact}</span>
          <span className="sr-only">{full}</span>
        </>
      ) : (
        full
      )}
    </span>
  );
}
