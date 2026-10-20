import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './messages';
import { safeNextPath } from './redirect';
import { parseForm, signUpSchema } from './schemas';

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

describe('signUpSchema', () => {
  it('normalizes the e-mail and accepts matching passwords', () => {
    const result = parseForm(
      signUpSchema,
      form({
        email: ' Awa@Example.SN ',
        password: 'motdepasse',
        confirmation: 'motdepasse',
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        email: 'awa@example.sn',
        password: 'motdepasse',
        confirmation: 'motdepasse',
      },
    });
  });

  it('reports field errors in French', () => {
    const result = parseForm(
      signUpSchema,
      form({ email: 'pas-un-email', password: 'court', confirmation: 'autre' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.fieldErrors).toMatchObject({
        email: 'Adresse e-mail invalide',
        password: 'Le mot de passe doit contenir au moins 8 caractères',
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
