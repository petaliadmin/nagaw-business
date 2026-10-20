import { describe, expect, it } from 'vitest';
import {
  createOrganizationSchema,
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
