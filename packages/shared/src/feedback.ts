import { z } from 'zod';

/** Feedback of the pilot shops to the platform (ADR-032). */
export const FEEDBACK_KINDS = ['problem', 'idea', 'question'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = 'new' | 'read' | 'done';

export const createFeedbackSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS, { error: 'Choisissez de quoi il s’agit' }),
    message: z
      .string()
      .trim()
      .min(1, 'Écrivez votre message')
      .max(2000, '2000 caractères au plus'),
    /** The page it was sent from (path only). */
    page: z
      .string()
      .trim()
      .max(200)
      .transform((page) => page.split('?')[0]!.split('#')[0]!)
      .default(''),
    clientOperationId: z.uuid('Identifiant invalide'),
  })
  .strict();
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const answerFeedbackSchema = z
  .object({
    status: z.enum(['read', 'done']),
    answer: z.string().trim().max(2000, '2000 caractères au plus').default(''),
  })
  .strict();
export type AnswerFeedbackInput = z.infer<typeof answerFeedbackSchema>;

export interface FeedbackDto {
  id: string;
  kind: FeedbackKind;
  message: string;
  page: string;
  status: FeedbackStatus;
  answer: string;
  answeredAt: string | null;
  createdAt: string;
}

/** For the platform: who sent it, from which shop. */
export interface AdminFeedbackDto extends FeedbackDto {
  shop: { id: string; name: string };
  author: string;
}
