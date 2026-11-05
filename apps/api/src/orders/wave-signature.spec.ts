import { createHmac } from 'node:crypto';
import { verifyWaveSignature, waveSignature } from './wave-signature.js';

const secret = 'wave_sn_WHS_test_secret_0123456789';
const body = '{"id":"AE_ijzo7oGgrlM7","type":"checkout.session.completed"}';
const now = 1_762_340_000;

describe('Wave-Signature', () => {
  it('signs timestamp + body with HMAC-SHA256, in hex', () => {
    const expected = createHmac('sha256', secret)
      .update(`${now}${body}`)
      .digest('hex');
    expect(waveSignature(secret, body, now)).toBe(`t=${now},v1=${expected}`);
    // A GET signs the timestamp alone.
    expect(waveSignature(secret, '', now)).toBe(
      `t=${now},v1=${createHmac('sha256', secret).update(String(now)).digest('hex')}`,
    );
  });

  it('accepts a webhook signed with the secret, on its raw body', () => {
    const header = waveSignature(secret, body, now - 10);
    expect(verifyWaveSignature(secret, header, body, now)).toBe(true);
  });

  it('accepts one good signature among several (rotation)', () => {
    const good = waveSignature(secret, body, now).split(',')[1];
    const header = `t=${now},v1=${'0'.repeat(64)},${good}`;
    expect(verifyWaveSignature(secret, header, body, now)).toBe(true);
  });

  it('refuses another secret, another body, an old or future timestamp', () => {
    const header = waveSignature(secret, body, now);
    expect(
      verifyWaveSignature('wave_sn_WHS_other_secret_0000', header, body, now),
    ).toBe(false);
    expect(verifyWaveSignature(secret, header, `${body} `, now)).toBe(false);
    expect(verifyWaveSignature(secret, header, body, now + 301)).toBe(false);
    expect(
      verifyWaveSignature(
        secret,
        waveSignature(secret, body, now + 60),
        body,
        now,
      ),
    ).toBe(false);
  });

  it('refuses a missing or malformed header', () => {
    for (const header of [
      undefined,
      '',
      't=abc,v1=xyz',
      `v1=${'a'.repeat(64)}`,
      `t=${now}`,
    ])
      expect(verifyWaveSignature(secret, header, body, now)).toBe(false);
  });
});
