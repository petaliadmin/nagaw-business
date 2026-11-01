/**
 * What a phone does with the answer to a batch (ADR-053). Before this, any
 * answer that was not 401, 403 or 404 meant « no network »: an operation
 * the server would never take blocked the whole queue, in silence.
 */
export type BatchAnswer =
  /** Applied: read the results, one by one. */
  | 'results'
  /** Nobody is signed in: everything waits on the phone. */
  | 'session'
  /** This device, or this shop, is refused for this person. */
  | 'device'
  /** The request itself is refused: it would be refused again as is. */
  | 'invalid'
  /** Nothing is known about this request: it comes back later. */
  | 'later';

/**
 * Requests go out with `redirect: 'manual'`: without a session a route
 * redirects to the sign-in page, whose HTML must not pass for an answer.
 * Such a response has the status 0.
 */
export function classifyAnswer(status: number): BatchAnswer {
  if (status >= 200 && status < 300) return 'results';
  if (status === 401 || status === 0) return 'session';
  if (status === 403 || status === 404) return 'device';
  if (status === 408 || status === 425 || status === 429) return 'later';
  return status >= 400 && status < 500 ? 'invalid' : 'later';
}

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60 * 1000;

/** The next try of an operation the server could not treat, n times. */
export function nextAttemptAt(attempts: number, now: number): number {
  const delay = BASE_DELAY_MS * 2 ** Math.min(attempts, 10);
  return now + Math.min(delay, MAX_DELAY_MS);
}

/**
 * Three random letters for the tickets of a phone that sells before the
 * server could give it its own prefix (always one or two letters at first).
 */
export function randomTicketPrefix(): string {
  const letters = crypto.getRandomValues(new Uint8Array(3));
  return String.fromCharCode(...[...letters].map((n) => 65 + (n % 26)));
}
