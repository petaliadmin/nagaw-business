/** Postgres SQLSTATE of a driver error, if any. */
export function pgErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';

// Connection exceptions (08xxx), too many connections, server shutting down.
const UNAVAILABLE_SQLSTATES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '53300',
  '57P01',
  '57P03',
]);
const UNAVAILABLE_NODE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

/**
 * The database could not be reached (or refused new connections): the
 * request may succeed if retried, unlike a bug. The pool reports a slow
 * connection only by its message.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  const code = pgErrorCode(error);
  if (
    code &&
    (UNAVAILABLE_SQLSTATES.has(code) || UNAVAILABLE_NODE_CODES.has(code))
  )
    return true;
  const message = error instanceof Error ? error.message : '';
  return /connection timeout|Connection terminated unexpectedly|timeout exceeded when trying to connect/i.test(
    message,
  );
}
