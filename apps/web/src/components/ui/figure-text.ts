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

const compactNumber = new Intl.NumberFormat('fr', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});

/**
 * The same amount shortened as people say it (ADR-065): `9 987 654 321
 * F CFA` → `9,99 Md F CFA`, `1 250 000 €` → `1,25 M €`. Null when the text
 * is not an amount (a count of sales, a name) or gains nothing.
 */
export function compactFigure(value: string): string | null {
  const match = /^(-?[\d\s  ]+(?:,\d+)?)\s*(.*)$/u.exec(value.trim());
  if (!match) return null;
  const unit = match[2]!.trim();
  // A currency (`F CFA`, `€`, `$US`), never words such as « ventes ».
  if (unit && /\p{Ll}{3,}/u.test(unit)) return null;
  const number = Number(match[1]!.replace(/[\s  ]/g, '').replace(',', '.'));
  if (!Number.isFinite(number) || Math.abs(number) < 10_000) return null;
  const short = compactNumber.format(number);
  return unit ? `${short} ${unit}` : short;
}
