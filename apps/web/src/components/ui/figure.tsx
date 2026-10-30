import type { CSSProperties, ReactNode } from 'react';

const NO_BREAK_SPACES = /[  ]/;

/**
 * A figure ready to fit its tile: the amount may go to the next line
 * before its currency, never inside its digits (`Intl` joins everything
 * with no-break spaces). `chars` is its longest unbreakable part.
 */
export function fitFigure(value: string): { text: string; chars: number } {
  const text = value.replace(
    new RegExp(`(\\d)${NO_BREAK_SPACES.source}(?=\\D)`),
    '$1 ',
  );
  const chars = Math.max(...text.split(' ').map((part) => part.length), 1);
  return { text, chars };
}

/**
 * A figure in a tile, which never leaves it, however large the amount: the
 * text gets smaller with its length and the width of the tile (`.figure`,
 * globals.css). Needs an `@container` tile around it; `--figure-max` caps
 * its size.
 */
export function Figure({
  value,
  className = '',
}: {
  value: ReactNode;
  className?: string;
}) {
  if (typeof value !== 'string' && typeof value !== 'number')
    return (
      <span className={`text-2xl [overflow-wrap:anywhere] ${className}`}>
        {value}
      </span>
    );
  const { text, chars } = fitFigure(String(value));
  return (
    <span
      className={`figure block ${className}`}
      style={{ '--figure-chars': chars } as CSSProperties}
    >
      {text}
    </span>
  );
}
