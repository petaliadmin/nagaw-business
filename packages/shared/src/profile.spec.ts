import { describe, expect, it } from 'vitest';
import {
  saveShopProfileSchema,
  showsModule,
  suggestedHiddenModules,
  updateShopModulesSchema,
} from './profile.js';

const answers = {
  sector: 'fashion_beauty',
  channels: ['social', 'delivery'],
  goals: ['profit'],
  teamSize: 'solo',
  offer: 'products',
  hiddenModules: ['accounting'],
};

describe('shop profile', () => {
  it('hides every module that no chosen answer shows', () => {
    expect(
      suggestedHiddenModules([
        { modules: ['suppliers', 'expenses', 'stats'] },
        { modules: ['expenses', 'stats'] },
      ]),
    ).toEqual(['documents', 'accounting', 'orders']);
  });

  it('hides nothing without an answer', () => {
    expect(suggestedHiddenModules([])).toEqual([]);
  });

  it('may hide everything an answer leaves out', () => {
    expect(suggestedHiddenModules([{ modules: [] }])).toEqual([
      'documents',
      'suppliers',
      'expenses',
      'stats',
      'accounting',
      'orders',
    ]);
  });

  it('reads the answers of the questionnaire', () => {
    expect(saveShopProfileSchema.safeParse(answers).success).toBe(true);
    expect(
      saveShopProfileSchema.safeParse({
        ...answers,
        sector: null,
        teamSize: null,
        channels: [],
        goals: [],
      }).success,
    ).toBe(true);
  });

  it('refuses unknown or repeated answers', () => {
    for (const wrong of [
      { channels: ['radio'] },
      { channels: ['social', 'social'] },
      { goals: ['profit', 'profit'] },
      { sector: 'Mode et beauté' },
      { teamSize: 'huge' },
      { hiddenModules: ['sales'] },
      { hiddenModules: ['stats', 'stats'] },
      { extra: true },
    ])
      expect(
        saveShopProfileSchema.safeParse({ ...answers, ...wrong }).success,
      ).toBe(false);
  });

  it('reads the modules chosen in the settings', () => {
    expect(
      updateShopModulesSchema.safeParse({ hiddenModules: [] }).success,
    ).toBe(true);
    expect(
      updateShopModulesSchema.safeParse({ hiddenModules: ['treasury'] })
        .success,
    ).toBe(false);
    expect(showsModule(['stats'], 'stats')).toBe(false);
    expect(showsModule(['stats'], 'accounting')).toBe(true);
  });
});
