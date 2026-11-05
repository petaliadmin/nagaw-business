import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/**
 * Secrets kept in the database (ADR-009): AES-256-GCM with a master key
 * outside the database. The stored text is `v1.<iv>.<tag>.<ciphertext>`,
 * each part in base64url; the version leaves room for a key rotation.
 * The organization id is bound as additional data: a secret copied to
 * another shop's row does not open.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32)
      throw new Error('SecretBox needs a 32-byte key');
  }

  seal(plain: string, context: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }

  open(sealed: string, context: string): string {
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== VERSION || !iv || !tag || !data)
      throw new Error('Unknown sealed secret format');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
