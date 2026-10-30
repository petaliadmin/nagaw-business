import { z } from 'zod';

/**
 * Page of a list (ADR-044). Both optional: without them a list answers as it
 * always did, for the screens that need it whole (checkout, editors).
 */
export const pageFields = {
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
};
export const pageQuerySchema = z.object(pageFields).strict();
export type PageQuery = z.infer<typeof pageQuerySchema>;
