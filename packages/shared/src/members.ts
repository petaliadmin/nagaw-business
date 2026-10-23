import { z } from 'zod';
import { roleSchema, type Role } from './permissions.js';

/** Roles an invitation may grant. Ownership is only given by promotion. */
export const INVITABLE_ROLES = ['admin', 'member', 'viewer'] as const;
export const invitableRoleSchema = z.enum(INVITABLE_ROLES);

export const MEMBER_STATUSES = ['active', 'disabled'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const createInvitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('Adresse e-mail invalide').max(320)),
    role: invitableRoleSchema,
  })
  .strict();
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateMemberSchema = z
  .object({
    role: roleSchema.optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'Aucun champ à modifier',
  });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/** 256-bit random token, base64url without padding. */
export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Lien d’invitation invalide');

export const invitationTokenBodySchema = z
  .object({ token: invitationTokenSchema })
  .strict();
export type InvitationTokenBody = z.infer<typeof invitationTokenBodySchema>;

/** Stored status, with `pending` past its expiry reported as `expired`. */
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface InvitationDto {
  id: string;
  email: string;
  role: z.infer<typeof invitableRoleSchema>;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: { userId: string; email: string };
}

/** The token is returned once, at creation, and never stored in clear. */
export interface CreatedInvitationDto {
  invitation: InvitationDto;
  token: string;
}

export interface InvitationPreviewDto {
  organizationName: string;
  email: string;
  role: z.infer<typeof invitableRoleSchema>;
  status: InvitationStatus;
  expiresAt: string;
  /** Whether the signed-in user's e-mail is the invited one. */
  emailMatches: boolean;
}

export type MemberChangeRefusal =
  'SELF_CHANGE_FORBIDDEN' | 'OWNER_PROTECTED' | 'OWNER_PROMOTION_FORBIDDEN';

/**
 * Who may change whose role or status, given that the actor already holds
 * `members.manage`. Nobody changes their own membership (no accidental
 * lock-out); only owners touch owners or grant ownership. The API enforces
 * this; the UI only uses it to hide actions.
 */
export function memberChangeRefusal(
  actor: { userId: string; role: Role },
  target: { userId: string; role: Role },
  change: { role?: Role },
): MemberChangeRefusal | null {
  if (actor.userId === target.userId) return 'SELF_CHANGE_FORBIDDEN';
  if (actor.role === 'owner') return null;
  if (target.role === 'owner') return 'OWNER_PROTECTED';
  if (change.role === 'owner') return 'OWNER_PROMOTION_FORBIDDEN';
  return null;
}
