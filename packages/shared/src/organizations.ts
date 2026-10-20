import { z } from 'zod';
import { roleSchema } from './permissions.js';

const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('fr', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Fuseau horaire inconnu' },
  );

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Le nom doit contenir au moins 2 caractères')
  .max(120, 'Le nom ne peut pas dépasser 120 caractères');

export const createOrganizationSchema = z
  .object({
    name: nameSchema,
    timezone: timezoneSchema.optional(),
    defaultCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Code devise ISO 4217 attendu')
      .optional(),
  })
  .strict();
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z
  .object({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
    defaultCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Code devise ISO 4217 attendu')
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  timezone: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWithRoleDto extends OrganizationDto {
  role: z.infer<typeof roleSchema>;
}

export interface MemberDto {
  userId: string;
  email: string;
  displayName: string | null;
  role: z.infer<typeof roleSchema>;
  status: 'active' | 'disabled';
  joinedAt: string;
}

export interface MeDto {
  id: string;
  email: string;
  displayName: string | null;
  locale: string;
  timezone: string;
  organizations: OrganizationWithRoleDto[];
}

export interface AuditLogDto {
  id: string;
  actorType: 'user' | 'agent' | 'system' | 'platform_admin';
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export const paginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z
      .string()
      .regex(/^\d{1,19}$/, 'Curseur invalide')
      .optional(),
  })
  .strict();
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
