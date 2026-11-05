import { z } from 'zod';
import { SHOP_OFFERS, type ShopOffer } from './organizations.js';

/**
 * Profile of the shop and the modules it shows (ADR-062).
 *
 * Modules a shop may hide. Selling, products, customers, treasury and the
 * settings are always shown. Hiding a module removes nothing and refuses
 * nothing: it only leaves the menu.
 */
export const SHOP_MODULES = [
  'documents',
  'suppliers',
  'expenses',
  'stats',
  'accounting',
] as const;
export type ShopModule = (typeof SHOP_MODULES)[number];

export const PROFILE_STATUSES = ['pending', 'answered', 'skipped'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const SALES_CHANNELS = ['counter', 'social', 'delivery'] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const TEAM_SIZES = ['solo', 'small', 'large'] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

/** An answer offered by the questionnaire, read from the database. */
export interface ProfileChoiceDto {
  key: string;
  label: string;
  /** Modules this answer shows. */
  modules: ShopModule[];
}

export interface ShopProfileDto {
  status: ProfileStatus;
  sector: string | null;
  channels: SalesChannel[];
  goals: string[];
  teamSize: TeamSize | null;
  answeredAt: string | null;
  offer: ShopOffer;
  hiddenModules: ShopModule[];
  choices: { sectors: ProfileChoiceDto[]; goals: ProfileChoiceDto[] };
}

const choiceKey = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, 'Choix inconnu');
const unique = <T>(values: readonly T[]) =>
  new Set(values).size === values.length;
const modulesSchema = z
  .array(z.enum(SHOP_MODULES, { error: 'Module inconnu' }))
  .max(SHOP_MODULES.length)
  .refine(unique, { message: 'Module en double' });

export const saveShopProfileSchema = z
  .object({
    sector: choiceKey.nullable(),
    channels: z
      .array(z.enum(SALES_CHANNELS, { error: 'Choix inconnu' }))
      .max(SALES_CHANNELS.length)
      .refine(unique, { message: 'Choix en double' }),
    goals: z
      .array(choiceKey)
      .max(20)
      .refine(unique, { message: 'Choix en double' }),
    teamSize: z.enum(TEAM_SIZES, { error: 'Choix inconnu' }).nullable(),
    offer: z.enum(SHOP_OFFERS, { error: 'Choix inconnu' }),
    /** Chosen on the last screen, from the suggestion of the answers. */
    hiddenModules: modulesSchema,
  })
  .strict();
export type SaveShopProfileInput = z.infer<typeof saveShopProfileSchema>;

export const updateShopModulesSchema = z
  .object({ hiddenModules: modulesSchema })
  .strict();
export type UpdateShopModulesInput = z.infer<typeof updateShopModulesSchema>;

/**
 * Modules the answers suggest hiding: every module that no chosen answer
 * shows. No answer at all hides nothing.
 */
export function suggestedHiddenModules(
  chosen: readonly Pick<ProfileChoiceDto, 'modules'>[],
): ShopModule[] {
  if (chosen.length === 0) return [];
  const shown = new Set(chosen.flatMap((choice) => choice.modules));
  return SHOP_MODULES.filter((module) => !shown.has(module));
}

export const showsModule = (
  hiddenModules: readonly ShopModule[],
  module: ShopModule,
) => !hiddenModules.includes(module);
