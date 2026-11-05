import { z } from 'zod';

/**
 * Payment of an order by Wave (ADR-065). The shop connects its own Wave
 * Business account; its secrets go to the API and never come back.
 */

const waveSecret = z
  .string()
  .trim()
  .regex(
    /^wave_[A-Za-z0-9_-]{16,200}$/,
    'Collez la clé telle que Wave l’affiche',
  );
const optionalWaveSecret = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .pipe(waveSecret.nullable());

export const connectWaveSchema = z
  .object({
    apiKey: waveSecret,
    /** Only for a key created with request signing. */
    signingSecret: optionalWaveSecret.default(null),
    /** Only when the shop registered the webhook address in its portal. */
    webhookSecret: optionalWaveSecret.default(null),
  })
  .strict();
export type ConnectWaveInput = z.infer<typeof connectWaveSchema>;

export interface WaveAccountDto {
  connected: boolean;
  /** Last four characters of the key, to tell which one is connected. */
  keyHint: string | null;
  signing: boolean;
  webhook: boolean;
  connectedAt: string | null;
  /** Address to register in the Wave portal, for the optional webhook. */
  webhookPath: string;
  /** The API can keep secrets (its master key is set). */
  available: boolean;
}

/** Where the customer goes to pay: must open in the browser (Wave docs). */
export interface WaveLaunchDto {
  launchUrl: string;
}

export const WAVE_STATES = [
  'none',
  'open',
  'succeeded',
  'failed',
  'expired',
] as const;
export type WaveState = (typeof WAVE_STATES)[number];

/** What a customer sees of an order after paying (or not). */
export interface PublicOrderStatusDto {
  reference: string;
  total: number;
  currency: string;
  paid: boolean;
  wave: WaveState;
  shopName: string;
}

/** Amount as Wave writes it: a string, no decimals for XOF. */
export function waveAmount(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor <= 0)
    throw new Error('Wave amount must be a positive integer');
  return String(minor);
}
