import { describe, expect, it } from 'vitest';
import { connectWaveSchema, waveAmount } from './wave.js';

describe('Wave', () => {
  it('writes amounts as Wave wants them: a string, no decimals', () => {
    expect(waveAmount(1000)).toBe('1000');
    for (const wrong of [0, -5, 12.5, Number.NaN])
      expect(() => waveAmount(wrong)).toThrow();
  });

  it('reads a key and its optional secrets', () => {
    const parsed = connectWaveSchema.parse({
      apiKey: ' wave_sn_prod_YhUNb9dxxxxi4bA6 ',
      signingSecret: '',
    });
    expect(parsed).toEqual({
      apiKey: 'wave_sn_prod_YhUNb9dxxxxi4bA6',
      signingSecret: null,
      webhookSecret: null,
    });
    for (const wrong of [
      { apiKey: 'sk_live_123' },
      { apiKey: 'wave_short' },
      { apiKey: 'wave_sn_prod_YhUNb9dxxxxi4bA6', webhookSecret: 'secret' },
      { apiKey: 'wave_sn_prod_YhUNb9dxxxxi4bA6', extra: 1 },
    ])
      expect(connectWaveSchema.safeParse(wrong).success).toBe(false);
  });
});
