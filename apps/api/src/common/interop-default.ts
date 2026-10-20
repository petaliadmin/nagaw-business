/**
 * Returns the callable default export of a CommonJS/ESM dual package.
 *
 * Depending on the module resolution in use (nodenext locally, Vercel's own
 * TypeScript build in production), a namespace import may expose the
 * function directly, under `.default`, or under `.default.default`. Unwraps
 * until a function is found and fails loudly otherwise.
 */
export function interopDefault<T extends (...args: never[]) => unknown>(
  mod: unknown,
  name: string,
): T {
  let current: unknown = mod;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current === 'function') return current as T;
    if (current === null || typeof current !== 'object') break;
    current = (current as { default?: unknown }).default;
  }
  throw new Error(`Module "${name}" has no callable default export`);
}
