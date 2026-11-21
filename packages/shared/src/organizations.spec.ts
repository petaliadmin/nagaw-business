import { describe, expect, it } from 'vitest';
import {
  createOrganizationSchema,
  displayFromHabits,
  shopHabitsSchema,
  showsSection,
  updateOrganizationSchema,
} from './organizations.js';

describe('createOrganizationSchema', () => {
  it('trims the name and accepts optional settings', () => {
    const parsed = createOrganizationSchema.parse({
      name: '  Acme SARL  ',
      timezone: 'Africa/Dakar',
      defaultCurrency: 'XOF',
    });
    expect(parsed.name).toBe('Acme SARL');
  });

  it('rejects unknown timezones, bad currencies and extra fields', () => {
    expect(
      createOrganizationSchema.safeParse({
        name: 'Acme',
        timezone: 'Mars/Base',
      }).success,
    ).toBe(false);
    expect(
      createOrganizationSchema.safeParse({
        name: 'Acme',
        defaultCurrency: 'xof',
      }).success,
    ).toBe(false);
    expect(
      createOrganizationSchema.safeParse({ name: 'Acme', status: 'suspended' })
        .success,
    ).toBe(false);
  });
});

describe('updateOrganizationSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateOrganizationSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateOrganizationSchema — invitation lifetime', () => {
  it('accepts whole hours within the database bounds', () => {
    expect(
      updateOrganizationSchema.parse({ invitationTtlHours: '72' }),
    ).toEqual({ invitationTtlHours: 72 });
    for (const value of [0, 721, 1.5]) {
      expect(
        updateOrganizationSchema.safeParse({ invitationTtlHours: value })
          .success,
      ).toBe(false);
    }
  });
});

describe('displayFromHabits (ADR-067)', () => {
  const yes = { credit: true, stock: true, documents: true, team: true };

  it('shows everything to a shop that says yes to everything', () => {
    expect(displayFromHabits('products', yes)).toEqual({
      hiddenSections: [],
      countsStockByDefault: true,
    });
  });

  it('keeps a simple shop simple: sales, credit and money', () => {
    expect(
      displayFromHabits('products', {
        credit: true,
        stock: false,
        documents: false,
        team: false,
      }),
    ).toEqual({
      hiddenSections: [
        'customers',
        'documents',
        'suppliers',
        'reports',
        'team',
      ],
      countsStockByDefault: false,
    });
  });

  it('never hides suppliers or counts stock for a shop of services', () => {
    expect(
      displayFromHabits('services', { ...yes, stock: false, team: false }),
    ).toEqual({ hiddenSections: ['team'], countsStockByDefault: true });
  });

  it('hides credit only to who does not sell on credit', () => {
    expect(
      displayFromHabits('both', { ...yes, credit: false }).hiddenSections,
    ).toEqual(['credit']);
  });
});

describe('hidden sections of a shop', () => {
  it('are stored in one order, without duplicate', () => {
    const parsed = updateOrganizationSchema.parse({
      hiddenSections: ['team', 'credit', 'team'],
    });
    expect(parsed.hiddenSections).toEqual(['credit', 'team']);
  });

  it('refuse a part that does not exist', () => {
    expect(
      updateOrganizationSchema.safeParse({ hiddenSections: ['caisse'] })
        .success,
    ).toBe(false);
  });

  it('may all be shown again', () => {
    expect(
      updateOrganizationSchema.parse({ hiddenSections: [] }).hiddenSections,
    ).toEqual([]);
  });

  it('are read from the four answers of the creation form', () => {
    expect(
      shopHabitsSchema.parse({
        credit: 'oui',
        stock: 'non',
        documents: 'non',
        team: 'oui',
      }),
    ).toEqual({ credit: true, stock: false, documents: false, team: true });
    expect(
      shopHabitsSchema.safeParse({
        credit: 'peut-être',
        stock: 'non',
        documents: 'non',
        team: 'oui',
      }).success,
    ).toBe(false);
  });

  it('tells whether a part is shown', () => {
    expect(showsSection({ hiddenSections: ['credit'] }, 'credit')).toBe(false);
    expect(showsSection({ hiddenSections: ['credit'] }, 'team')).toBe(true);
  });
});
