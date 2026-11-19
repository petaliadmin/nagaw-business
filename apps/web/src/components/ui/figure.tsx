'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { compactFigure, fitFigure } from './figure-text';

export { fitFigure } from './figure-text';

/** The size under which a big figure is shortened rather than shrunk. */
function readableSize(element: HTMLElement): number {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const max = getComputedStyle(element).getPropertyValue('--figure-max').trim();
  const maxPx = max.endsWith('rem')
    ? parseFloat(max) * root
    : max.endsWith('px')
      ? parseFloat(max)
      : 1.5 * root;
  // A hero figure may get smaller, not tiny: 60 % of its size, 16 px at least.
  return Math.max(16, 0.6 * maxPx);
}

let canvas: HTMLCanvasElement | null = null;

/** Width of the longest unbreakable part at a given size, in its own font. */
function widthAt(element: HTMLElement, text: string, size: number): number {
  canvas ??= document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  const style = getComputedStyle(element);
  context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  return Math.max(
    ...text.split(' ').map((part) => context.measureText(part).width),
  );
}

/**
 * A figure in a tile, which never leaves it, however large the amount: the
 * text gets smaller with its length and the width of the tile (`.figure`,
 * globals.css). When even so a big amount would no longer be readable, it
 * is shortened as people say it — `9,99 Md F CFA` — and only then
 * (ADR-065); the full amount stays in its title and for screen readers.
 * Needs an `@container` tile around it; `--figure-max` caps its size.
 */
export function Figure({
  value,
  className = '',
}: {
  value: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);
  const text =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : null;
  const compact = text ? compactFigure(text) : null;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !text || !compact) return;
    const full = fitFigure(text).text;
    const check = () => {
      const available = element.clientWidth;
      if (available === 0) return;
      setShort(widthAt(element, full, readableSize(element)) > available);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, compact]);

  if (text === null)
    return (
      <span className={`text-2xl [overflow-wrap:anywhere] ${className}`}>
        {value}
      </span>
    );
  const shown = fitFigure(short && compact ? compact : text);
  return (
    <span
      ref={ref}
      title={short ? text : undefined}
      className={`figure block ${className}`}
      style={{ '--figure-chars': shown.chars } as CSSProperties}
    >
      {short && compact ? (
        <>
          <span aria-hidden>{shown.text}</span>
          <span className="sr-only">{text}</span>
        </>
      ) : (
        shown.text
      )}
    </span>
  );
}
