/** Up to two initials for the round avatar: `Fatou Ndiaye` → `FN`. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? [words[0], words[words.length - 1]].map((w) => [...w][0])
      : [...(words[0] ?? '')].slice(0, 2);
  return letters.join('').toLocaleUpperCase('fr') || '?';
}

const AVATAR_TONES = [
  'bg-brand-soft text-brand-ink',
  'bg-sales-soft text-sales-ink',
  'bg-stock-soft text-stock-ink',
  'bg-invoices-soft text-invoices-ink',
  'bg-stats-soft text-stats-ink',
  'bg-accounting-soft text-accounting-ink',
] as const;

/** Colour of an avatar: always the same one for the same customer. */
export function avatarTone(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}
