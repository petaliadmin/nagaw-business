import { CircleEllipsis, House, Lightbulb, Package } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { categoryIcon } from './category-icons';

describe('categoryIcon', () => {
  it('picks the most precise account', () => {
    expect(categoryIcon('601')).toBe(Package);
    expect(categoryIcon('605')).toBe(Lightbulb);
    expect(categoryIcon('622')).toBe(House);
  });
  it('falls back on a neutral picture', () => {
    expect(categoryIcon('658')).toBe(CircleEllipsis);
    expect(categoryIcon(undefined)).toBe(CircleEllipsis);
  });
});
