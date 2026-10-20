import { describe, expect, it } from 'vitest';
import { apiErrorSchema } from './api-error.js';

describe('apiErrorSchema', () => {
  it('accepts the documented error envelope', () => {
    const parsed = apiErrorSchema.safeParse({
      error: { code: 'NOT_FOUND', message: 'Introuvable', requestId: 'r1' },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a payload without code', () => {
    const parsed = apiErrorSchema.safeParse({ error: { message: 'x' } });
    expect(parsed.success).toBe(false);
  });
});
