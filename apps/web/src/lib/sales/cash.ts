/**
 * Amounts a customer usually hands over for a cash payment: the exact
 * total, then the next round amounts of the notes that fit the total
 * (F CFA: 500, 1 000, 2 000, 5 000, 10 000). For 1 750, a customer gives
 * 2 000, 5 000 or 10 000; for 5 000, 10 000, not three 2 000 notes. One tap
 * fills « Somme reçue » and shows the change. Amounts are in the
 * currency's minor units; a currency with decimals gets the exact total.
 */
const NOTES = [500, 1_000, 2_000, 5_000, 10_000];

export function cashSuggestions(
  total: number,
  currency: string,
  max = 4,
): number[] {
  if (!(total > 0)) return [];
  const amounts = [total];
  if (currency === 'XOF' || currency === 'XAF') {
    // The largest note that fits in the total, and the notes above it.
    const from = NOTES.filter((note) => note <= total).at(-1) ?? NOTES[0]!;
    for (const note of NOTES.filter((n) => n >= from)) {
      const next = Math.ceil(total / note) * note;
      if (next > total && !amounts.includes(next)) amounts.push(next);
    }
  }
  return amounts.sort((a, b) => a - b).slice(0, max);
}
