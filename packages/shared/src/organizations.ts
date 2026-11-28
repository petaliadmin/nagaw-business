import { z } from 'zod';
import { documentColorSchema } from './document-colors.js';
import type { MemberStatus } from './members.js';
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

/** Signature and stamp, printed on issued invoices (ADR-052). */
export const SHOP_MARKS = ['signature', 'stamp'] as const;
export type ShopMarkKind = (typeof SHOP_MARKS)[number];

/** What a shop sells: its screens follow (ADR-047). */
export const SHOP_OFFERS = ['products', 'services', 'both'] as const;
export type ShopOffer = (typeof SHOP_OFFERS)[number];
const offerSchema = z.enum(SHOP_OFFERS, { error: 'Choix inconnu' });

export const sellsGoods = (offer: ShopOffer) => offer !== 'services';
export const sellsServices = (offer: ShopOffer) => offer !== 'products';

/**
 * Parts of the application a shop may hide (ADR-067). A display setting,
 * like the offer (ADR-047): the API refuses nothing, hidden data stays.
 * Caisse, Ventes, Produits et services and Argent are always shown.
 */
export const SHOP_SECTIONS = [
  'credit',
  'customers',
  'documents',
  'suppliers',
  'expenses',
  'reports',
  'team',
] as const;
export type ShopSection = (typeof SHOP_SECTIONS)[number];

const hiddenSectionsSchema = z
  .array(z.enum(SHOP_SECTIONS, { error: 'Partie inconnue' }))
  .max(SHOP_SECTIONS.length)
  // One order and no duplicate: the stored value never depends on the form.
  .transform((sections) =>
    SHOP_SECTIONS.filter((section) => sections.includes(section)),
  );

/** What a shop shows, read by its menus, home page and product form. */
export interface ShopDisplay {
  offer: ShopOffer;
  hiddenSections: readonly ShopSection[];
  /** Whether a new product counts its stock, before the owner chooses. */
  countsStockByDefault: boolean;
  /** Customer orders, turned on by the merchant only (ADR-072). */
  ordersEnabled?: boolean;
}

export const showsSection = (
  display: Pick<ShopDisplay, 'hiddenSections'>,
  section: ShopSection,
) => !display.hiddenSections.includes(section);

/** « Comment travaillez-vous ? », asked when the shop is created. */
export interface ShopHabits {
  /** Sells on credit: « Ils vous doivent ». */
  credit: boolean;
  /** Counts what is left of its products. */
  stock: boolean;
  /** Makes invoices or quotes. */
  documents: boolean;
  /** Someone else sells with the owner. */
  team: boolean;
}

const yesNo = z
  .enum(['oui', 'non'], { error: 'Répondez oui ou non' })
  .transform((answer) => answer === 'oui');

/** The four answers, as the creation form sends them. */
export const shopHabitsSchema = z
  .object({
    credit: yesNo,
    stock: yesNo,
    documents: yesNo,
    team: yesNo,
  })
  .strict();

/**
 * The display that follows the answers (ADR-067). A shop that says yes to
 * everything sees the whole application, as before.
 */
export function displayFromHabits(
  offer: ShopOffer,
  habits: ShopHabits,
): Omit<ShopDisplay, 'offer'> {
  const countsStock = sellsGoods(offer) && habits.stock;
  const hidden = new Set<ShopSection>();
  if (!habits.credit) hidden.add('credit');
  if (!habits.documents) {
    hidden.add('documents');
    hidden.add('customers');
  }
  if (!habits.team) hidden.add('team');
  if (sellsGoods(offer) && !habits.stock) hidden.add('suppliers');
  // Nothing counted and no invoice: the shop sells and looks at its day.
  if (!countsStock && !habits.documents) hidden.add('reports');
  return {
    hiddenSections: SHOP_SECTIONS.filter((section) => hidden.has(section)),
    // A shop of services has no stock: the default only matters for goods.
    countsStockByDefault: sellsGoods(offer) ? habits.stock : true,
  };
}

const ownerNameSchema = z
  .string()
  .trim()
  .min(2, 'Indiquez votre nom complet')
  .max(120, '120 caractères au plus');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{8,30}$/, 'Numéro de téléphone invalide');

export const createOrganizationSchema = z
  .object({
    name: nameSchema,
    timezone: timezoneSchema.optional(),
    defaultCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Code devise ISO 4217 attendu')
      .optional(),
    /** Full name of the owner, kept on their profile. */
    ownerName: ownerNameSchema.optional(),
    /** Phone of the shop, printed on its documents. */
    phone: phoneSchema.optional(),
    offer: offerSchema.optional(),
    hiddenSections: hiddenSectionsSchema.optional(),
    countsStockByDefault: z.boolean().optional(),
  })
  .strict();
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/** The form asks both: the API stays open to its older clients. */
export const createShopFormSchema = createOrganizationSchema.extend({
  ownerName: ownerNameSchema,
  phone: phoneSchema,
  offer: offerSchema,
});

/** Bounds mirror the database check constraint. */
export const INVITATION_TTL_HOURS = { min: 1, max: 720 } as const;

const text = (max: number) =>
  z.string().trim().max(max, `${max} caractères au plus`);
const days = (min: number, max: number) =>
  z.coerce
    .number()
    .int('Nombre de jours entier attendu')
    .min(min, `Au moins ${min} jour${min > 1 ? 's' : ''}`)
    .max(max, `Au plus ${max} jours`);

export const updateOrganizationSchema = z
  .object({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
    defaultCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Code devise ISO 4217 attendu')
      .optional(),
    invitationTtlHours: z.coerce
      .number()
      .int('Nombre d’heures entier attendu')
      .min(INVITATION_TTL_HOURS.min, 'Au moins 1 heure')
      .max(INVITATION_TTL_HOURS.max, 'Au plus 720 heures (30 jours)')
      .optional(),
    // Printed on quotes and invoices (ADR-026).
    legalName: text(160).optional(),
    address: text(300).optional(),
    phone: text(30).optional(),
    phoneCountryCode: z
      .string()
      .trim()
      .regex(
        /^[1-9]\d{0,2}$/,
        'Indiquez l’indicatif sans + ni 00, par exemple 221',
      )
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(
        z.union([z.literal(''), z.email('Adresse e-mail invalide').max(320)]),
      )
      .optional(),
    taxId: text(40).optional(),
    tradeRegister: text(60).optional(),
    invoiceFooter: text(500).optional(),
    documentColor: documentColorSchema.optional(),
    offer: offerSchema.optional(),
    hiddenSections: hiddenSectionsSchema.optional(),
    countsStockByDefault: z.boolean().optional(),
    /** Customer orders, off until the merchant turns them on (ADR-072). */
    ordersEnabled: z.boolean().optional(),
    invoiceDueDays: days(0, 365).optional(),
    quoteValidityDays: days(1, 365).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export interface OrganizationDto {
  /** Added to local phone numbers for WhatsApp links. */
  phoneCountryCode: string;
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  timezone: string;
  defaultCurrency: string;
  /** Lifetime of new invitations. */
  invitationTtlHours: number;
  /** Identity printed on documents (ADR-026). */
  legalName: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  tradeRegister: string;
  invoiceFooter: string;
  invoiceDueDays: number;
  quoteValidityDays: number;
  offer: ShopOffer;
  /** Parts of the application the shop hides (ADR-067). */
  hiddenSections: ShopSection[];
  /** Whether a new product counts its stock at first (ADR-067). */
  countsStockByDefault: boolean;
  /** Customer orders, an option the merchant turns on (ADR-072). */
  ordersEnabled: boolean;
  /** Colour of the shop's documents, `#rrggbb` (ADR-044). */
  documentColor: string;
  /** Changes with the logo (cache key); null without logo. */
  logoVersion: string | null;
  /** Same for the signature and the stamp of the invoices (ADR-052). */
  signatureVersion: string | null;
  stampVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWithRoleDto extends OrganizationDto {
  role: z.infer<typeof roleSchema>;
  /** The caller's own limit of reduction on a sale; null: none (ADR-038). */
  maxDiscountBasisPoints: number | null;
  /** Entered by the platform administrator, not a membership (ADR-040). */
  platformAccess: boolean;
}

export interface MemberDto {
  userId: string;
  email: string;
  displayName: string | null;
  role: z.infer<typeof roleSchema>;
  status: MemberStatus;
  /** Largest reduction this person may give on a sale; null: no limit. */
  maxDiscountBasisPoints: number | null;
  joinedAt: string;
}

export interface MeDto {
  id: string;
  email: string;
  /** International digits; null for an account still on its e-mail. */
  phone: string | null;
  displayName: string | null;
  locale: string;
  timezone: string;
  organizations: OrganizationWithRoleDto[];
  /** Administrator of the platform (ADR-030). */
  platformAdmin: boolean;
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
