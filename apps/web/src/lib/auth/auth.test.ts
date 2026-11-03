import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './messages';
import { safeNextPath } from './redirect';
import { createOrganizationSchema } from '@nagaw/shared';
import {
  parseForm,
  phoneCredentialsFormSchema,
  phoneSignInSchema,
} from './schemas';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('safeNextPath', () => {
  it('keeps in-app paths', () => {
    expect(safeNextPath('/espace?x=1')).toBe('/espace?x=1');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '',
    null,
    undefined,
  ])('rejects %s', (value) => {
    expect(safeNextPath(value)).toBe('/espace');
  });
});

describe('phone forms', () => {
  it('builds the number of the account from the country chosen', () => {
    expect(
      parseForm(
        phoneSignInSchema,
        form({ country: 'SN', number: ' 77 123 45 67 ', pin: '4826' }),
      ),
    ).toEqual({ ok: true, data: { phone: '221771234567', pin: '4826' } });
  });

  it('says in French what is wrong with a number or a code', () => {
    const result = parseForm(
      phoneCredentialsFormSchema,
      form({ country: 'SN', number: '77 12', pin: '1234', confirmation: '1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.fieldErrors).toMatchObject({
        pin: 'Ce code est trop facile à deviner. Choisissez-en un autre.',
      });
    }
    const number = parseForm(
      phoneCredentialsFormSchema,
      form({
        country: 'SN',
        number: '77 12',
        pin: '4826',
        confirmation: '4826',
      }),
    );
    expect(number.ok).toBe(false);
    if (!number.ok) {
      expect(number.state.fieldErrors).toEqual({
        number: 'Numéro de téléphone invalide pour ce pays',
      });
    }
  });

  it('asks for the same code twice', () => {
    const result = parseForm(
      phoneCredentialsFormSchema,
      form({
        country: 'SN',
        number: '771234567',
        pin: '4826',
        confirmation: '4862',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.fieldErrors).toEqual({
        confirmation: 'Les deux codes ne sont pas pareils',
      });
    }
  });
});

describe('authErrorMessage', () => {
  it('translates known codes and falls back for unknown ones', () => {
    expect(authErrorMessage('invalid_credentials')).toBe(
      'Adresse e-mail ou mot de passe incorrect.',
    );
    expect(authErrorMessage('something_new')).toBe(
      'Une erreur est survenue. Réessayez.',
    );
    expect(authErrorMessage(undefined)).toBe(
      'Une erreur est survenue. Réessayez.',
    );
  });
});

describe('parseForm with strict schemas', () => {
  it('ignores the hidden $ACTION_* fields React adds to forms', () => {
    const data = form({
      $ACTION_REF_3: '',
      '$ACTION_3:0': '{}',
      $ACTION_KEY: 'k',
      name: 'Acme Dakar',
    });
    expect(parseForm(createOrganizationSchema, data)).toEqual({
      ok: true,
      data: { name: 'Acme Dakar' },
    });
  });

  it('still rejects unknown user-supplied fields', () => {
    const result = parseForm(
      createOrganizationSchema,
      form({ name: 'Acme', status: 'suspended' }),
    );
    expect(result.ok).toBe(false);
  });
});
