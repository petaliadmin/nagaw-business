import { describe, expect, it } from 'vitest';
import { isDatabaseUnavailable } from './pg-errors.js';

describe('database unavailability', () => {
  it('recognises a database that cannot be reached, worth retrying', () => {
    expect(
      isDatabaseUnavailable(
        new Error('Connection terminated due to connection timeout'),
      ),
    ).toBe(true);
    expect(
      isDatabaseUnavailable(
        Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        }),
      ),
    ).toBe(true);
    expect(
      isDatabaseUnavailable(
        Object.assign(new Error('too many clients'), { code: '53300' }),
      ),
    ).toBe(true);
  });

  it('leaves the other errors to the generic 500', () => {
    expect(
      isDatabaseUnavailable(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      ),
    ).toBe(false);
    expect(isDatabaseUnavailable(new TypeError('x is undefined'))).toBe(false);
    expect(isDatabaseUnavailable('boom')).toBe(false);
  });
});
