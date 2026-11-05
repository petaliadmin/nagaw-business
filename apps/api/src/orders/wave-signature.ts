import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * `Wave-Signature` (docs.wave.com): `t=<unix seconds>,v1=<hex>`, where the
 * hex is HMAC-SHA256 of `timestamp + raw body` with the secret. The same
 * scheme signs our requests (when the key asks for it) and Wave's webhooks.
 */
export function waveSignature(
  secret: string,
  body: string,
  timestamp: number,
): string {
  const v1 = createHmac('sha256', secret)
    .update(`${timestamp}${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

/** Wave refuses a request signed more than 5 minutes ago. */
const MAX_AGE_SECONDS = 5 * 60;
const MAX_AHEAD_SECONDS = 30;

/**
 * Checks a webhook against its raw body: the body must not be parsed and
 * serialized again before (Wave docs). Several `v1` may come during a
 * rotation of the secret; one matching is enough.
 */
export function verifyWaveSignature(
  secret: string,
  header: string | undefined,
  rawBody: string,
  nowSeconds: number,
): boolean {
  if (!header) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't' && value && /^\d{1,12}$/.test(value))
      timestamp = Number(value);
    if (key === 'v1' && value && /^[0-9a-f]{64}$/.test(value))
      signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return false;
  if (
    nowSeconds - timestamp > MAX_AGE_SECONDS ||
    timestamp - nowSeconds > MAX_AHEAD_SECONDS
  )
    return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('hex'),
    'utf8',
  );
  return signatures.some((signature) =>
    timingSafeEqual(Buffer.from(signature, 'utf8'), expected),
  );
}
