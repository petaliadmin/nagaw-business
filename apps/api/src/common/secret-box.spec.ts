import { randomBytes } from 'node:crypto';
import { SecretBox } from './secret-box.js';

describe('SecretBox', () => {
  const box = new SecretBox(randomBytes(32).toString('base64'));

  it('opens what it sealed, and never shows the secret', () => {
    const sealed = box.seal('wave_sn_prod_secret', 'shop-a');
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('wave_sn_prod_secret');
    expect(box.open(sealed, 'shop-a')).toBe('wave_sn_prod_secret');
    // A fresh IV each time.
    expect(box.seal('wave_sn_prod_secret', 'shop-a')).not.toBe(sealed);
  });

  it('refuses a secret moved to another shop, or changed', () => {
    const sealed = box.seal('wave_sn_prod_secret', 'shop-a');
    expect(() => box.open(sealed, 'shop-b')).toThrow();
    const parts = sealed.split('.');
    parts[3] = Buffer.from('autre').toString('base64url');
    expect(() => box.open(parts.join('.'), 'shop-a')).toThrow();
  });

  it('refuses another key and a wrong key length', () => {
    const sealed = box.seal('secret', 'shop-a');
    const other = new SecretBox(randomBytes(32).toString('base64'));
    expect(() => other.open(sealed, 'shop-a')).toThrow();
    expect(() => new SecretBox(randomBytes(16).toString('base64'))).toThrow();
  });
});
