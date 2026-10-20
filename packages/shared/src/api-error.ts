import { z } from 'zod';

/**
 * Single error envelope returned by every API endpoint (see docs/API.md).
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
