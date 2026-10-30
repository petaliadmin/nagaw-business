import { z } from 'zod';
import { MAX_AMOUNT } from './money.js';
import { pageFields } from './pagination.js';

// ---------------------------------------------------------------------------
// Units and quantities
// ---------------------------------------------------------------------------

/** Units a product is sold in. Only some accept decimals (weight, volume). */
export const UNITS = {
  piece: { label: 'pièce', decimals: false },
  carton: { label: 'carton', decimals: false },
  paquet: { label: 'paquet', decimals: false },
  sachet: { label: 'sachet', decimals: false },
  bouteille: { label: 'bouteille', decimals: false },
  sac: { label: 'sac', decimals: false },
  kg: { label: 'kg', decimals: true },
  g: { label: 'g', decimals: false },
  litre: { label: 'litre', decimals: true },
  ml: { label: 'ml', decimals: false },
  metre: { label: 'mètre', decimals: true },
  prestation: { label: 'prestation', decimals: false },
  forfait: { label: 'forfait', decimals: false },
  heure: { label: 'heure', decimals: true },
  jour: { label: 'jour', decimals: true },
} as const;
export type Unit = keyof typeof UNITS;
export const UNIT_KEYS = Object.keys(UNITS) as [Unit, ...Unit[]];

/** What a shop sells: goods it may count, or work it does (ADR-045). */
export const PRODUCT_KINDS = ['product', 'service'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** The units a service is sold in, first in its form. */
export const SERVICE_UNITS = [
  'prestation',
  'forfait',
  'heure',
  'jour',
] as const;

const FEMININE_UNITS: readonly Unit[] = ['piece', 'bouteille', 'prestation'];

/** « la pièce », « le kg », « l’heure »: after a price. */
export function perUnit(unit: Unit): string {
  if (unit === 'heure') return 'l’heure';
  return `${FEMININE_UNITS.includes(unit) ? 'la' : 'le'} ${UNITS[unit].label}`;
}

/** Bound of numeric(14,3). */
export const MAX_QUANTITY = 99_999_999_999;

function hasAtMostThreeDecimals(value: number): boolean {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

/** A quantity of goods: up to 3 decimals, as stored in numeric(14,3). */
export const quantitySchema = z
  .number({ error: 'Quantité invalide' })
  .finite('Quantité invalide')
  .max(MAX_QUANTITY, 'Quantité trop grande')
  .refine(hasAtMostThreeDecimals, 'Trois décimales au plus');

/** Words of the unit that take an « s » in the plural. */
const PLURAL_S: ReadonlySet<Unit> = new Set([
  'piece',
  'carton',
  'paquet',
  'sachet',
  'bouteille',
  'sac',
  'litre',
  'metre',
]);

const quantityFormat = new Intl.NumberFormat('fr', {
  maximumFractionDigits: 3,
});

/** `12 pièces`, `1,5 kg`, `1 sac`. */
export function formatQuantity(quantity: number, unit: Unit): string {
  const label = UNITS[unit].label;
  const plural = Math.abs(quantity) >= 2 && PLURAL_S.has(unit);
  return `${quantityFormat.format(quantity)} ${plural ? `${label}s` : label}`;
}

/** Products counted in whole units (pièce, carton…) refuse decimals. */
export function quantityFitsUnit(quantity: number, unit: Unit): boolean {
  return UNITS[unit].decimals || Number.isInteger(quantity);
}

/**
 * Stock units taken by `quantity` of a selling unit worth `factor` of them
 * (ADR-038); null when the result needs more than 3 decimals.
 */
export function baseQuantityOf(
  quantity: number,
  factor: number,
): number | null {
  const base = quantity * factor;
  return hasAtMostThreeDecimals(base) ? Math.round(base * 1000) / 1000 : null;
}

export const amountSchema = z
  .number({ error: 'Montant invalide' })
  .int('Montant invalide')
  .min(0, 'Le montant ne peut pas être négatif')
  .max(MAX_AMOUNT, 'Montant trop élevé');

const uuid = z.uuid('Identifiant invalide');
const archivableStatus = z.enum(['active', 'archived']);
export type CatalogStatus = z.infer<typeof archivableStatus>;

// ---------------------------------------------------------------------------
// Tax rates
// ---------------------------------------------------------------------------

const taxRateName = z
  .string()
  .trim()
  .min(1, 'Donnez un nom à cette taxe')
  .max(60, '60 caractères au plus');
const basisPoints = z
  .number({ error: 'Taux invalide' })
  .int('Taux invalide')
  .min(0, 'Le taux ne peut pas être négatif')
  .max(10000, 'Le taux ne peut pas dépasser 100 %');

export const createTaxRateSchema = z
  .object({ name: taxRateName, rateBasisPoints: basisPoints })
  .strict();
export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;

export const updateTaxRateSchema = z
  .object({
    name: taxRateName.optional(),
    rateBasisPoints: basisPoints.optional(),
    status: archivableStatus.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>;

export interface TaxRateDto {
  id: string;
  name: string;
  rateBasisPoints: number;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

/** `1800` → `18 %`, `550` → `5,5 %`. */
export function formatRate(basisPointsValue: number): string {
  return `${new Intl.NumberFormat('fr', { maximumFractionDigits: 2 }).format(basisPointsValue / 100)} %`;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Module colors of DESIGN.md a category can use. */
export const CATEGORY_COLORS = [
  'brand',
  'sales',
  'stock',
  'invoices',
  'stats',
  'accounting',
  'warning',
  'danger',
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

const categoryName = z
  .string()
  .trim()
  .min(1, 'Donnez un nom à la catégorie')
  .max(60, '60 caractères au plus');

export const createCategorySchema = z
  .object({ name: categoryName, color: z.enum(CATEGORY_COLORS).optional() })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
    status: archivableStatus.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface CategoryDto {
  id: string;
  name: string;
  color: CategoryColor;
  status: CatalogStatus;
  /** Active products in this category. */
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

const supplierName = z
  .string()
  .trim()
  .min(1, 'Donnez le nom du fournisseur')
  .max(120, '120 caractères au plus');
const phone = z.string().trim().max(30, '30 caractères au plus');
const notes = z.string().trim().max(1000, '1000 caractères au plus');

export const createSupplierSchema = z
  .object({
    name: supplierName,
    phone: phone.default(''),
    notes: notes.default(''),
  })
  .strict();
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z
  .object({
    name: supplierName.optional(),
    phone: phone.optional(),
    notes: notes.optional(),
    status: archivableStatus.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export interface SupplierDto {
  id: string;
  name: string;
  phone: string;
  notes: string;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const productName = z
  .string()
  .trim()
  .min(1, 'Donnez un nom au produit')
  .max(120, '120 caractères au plus');
/** Empty means « no barcode ». */
const barcode = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .pipe(
    z
      .string()
      .regex(/^[0-9A-Za-z-]{4,32}$/, 'Code-barres : 4 à 32 chiffres ou lettres')
      .nullable(),
  );
const threshold = quantitySchema.min(0, 'Le seuil ne peut pas être négatif');

const productFields = {
  name: productName,
  categoryId: uuid.nullable(),
  unit: z.enum(UNIT_KEYS, { error: 'Unité inconnue' }),
  salePrice: amountSchema,
  purchasePrice: amountSchema.nullable(),
  taxRateId: uuid.nullable(),
  barcode: barcode.nullable(),
  trackStock: z.boolean(),
  lowStockThreshold: threshold.nullable(),
  kind: z.enum(PRODUCT_KINDS, { error: 'Nature inconnue' }),
};

const SERVICE_WITHOUT_STOCK = 'Un service n’a pas de stock';

export const createProductSchema = z
  .object({
    ...productFields,
    kind: productFields.kind.default('product'),
    /** Stock on hand when the product is added; recorded as a movement. */
    initialStock: quantitySchema
      .positive('Le stock de départ doit être positif')
      .nullable()
      .default(null),
    /** Idempotency key of the creation (and of its initial movement). */
    clientOperationId: uuid,
  })
  .strict()
  .refine((value) => value.trackStock || value.initialStock === null, {
    path: ['initialStock'],
    message:
      'Pas de stock de départ pour un produit dont le stock n’est pas suivi',
  })
  .refine((value) => value.kind === 'product' || !value.trackStock, {
    path: ['trackStock'],
    message: SERVICE_WITHOUT_STOCK,
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: productFields.name.optional(),
    categoryId: productFields.categoryId.optional(),
    unit: productFields.unit.optional(),
    salePrice: productFields.salePrice.optional(),
    purchasePrice: productFields.purchasePrice.optional(),
    taxRateId: productFields.taxRateId.optional(),
    barcode: productFields.barcode.optional(),
    trackStock: productFields.trackStock.optional(),
    lowStockThreshold: productFields.lowStockThreshold.optional(),
    kind: productFields.kind.optional(),
    status: archivableStatus.optional(),
    /** Version read before editing: a stale version is a conflict (ADR-020). */
    version: z.number().int().min(1),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Aucun champ à modifier',
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export type StockLevel = 'untracked' | 'out' | 'low' | 'ok';

/** « Épuisé » at zero or below, « bientôt épuisé » at the threshold. */
export function stockLevel(product: {
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number | null;
}): StockLevel {
  if (!product.trackStock) return 'untracked';
  if (product.stockQuantity <= 0) return 'out';
  if (
    product.lowStockThreshold !== null &&
    product.stockQuantity <= product.lowStockThreshold
  )
    return 'low';
  return 'ok';
}

export interface ProductDto {
  id: string;
  name: string;
  category: { id: string; name: string; color: CategoryColor } | null;
  /** Stock unit: the stock, the inventory and the purchase price use it. */
  unit: Unit;
  /** Price of one stock unit. */
  salePrice: number;
  purchasePrice: number | null;
  taxRate: { id: string; name: string; rateBasisPoints: number } | null;
  barcode: string | null;
  kind: ProductKind;
  trackStock: boolean;
  lowStockThreshold: number | null;
  /** Sum of the stock movements. */
  stockQuantity: number;
  stockLevel: StockLevel;
  status: CatalogStatus;
  version: number;
  /** Changes with the photo (cache key); null without photo. */
  photoVersion: string | null;
  /** Other units it is sold in (active ones), smallest first. */
  units: ProductUnitDto[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Selling units (ADR-038)
// ---------------------------------------------------------------------------

const unitLabel = z
  .string()
  .trim()
  .min(1, 'Donnez un nom à cette unité')
  .max(60, '60 caractères au plus');

/** Stock units in one selling unit, never changed afterwards. */
const factorSchema = quantitySchema.positive('Le nombre doit être positif');

export const createProductUnitSchema = z
  .object({
    label: unitLabel,
    factor: factorSchema,
    /** Null: priced from the stock unit (its price × the stock taken). */
    salePrice: amountSchema.nullable().default(null),
    allowsDecimals: z.boolean().default(false),
    barcode: barcode.nullable().default(null),
    clientOperationId: uuid,
  })
  .strict();
export type CreateProductUnitInput = z.infer<typeof createProductUnitSchema>;

/** The factor cannot change: archive the unit and create another one. */
export const updateProductUnitSchema = z
  .object({
    label: unitLabel.optional(),
    salePrice: amountSchema.nullable().optional(),
    allowsDecimals: z.boolean().optional(),
    barcode: barcode.nullable().optional(),
    status: archivableStatus.optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Aucun champ à modifier',
  });
export type UpdateProductUnitInput = z.infer<typeof updateProductUnitSchema>;

export interface ProductUnitDto {
  id: string;
  label: string;
  factor: number;
  /** Null: priced from the stock unit. */
  salePrice: number | null;
  allowsDecimals: boolean;
  barcode: string | null;
  status: CatalogStatus;
  version: number;
}

// ---------------------------------------------------------------------------
// Unit templates of the shop (ADR-038)
// ---------------------------------------------------------------------------

export const createUnitTemplateSchema = z
  .object({
    label: unitLabel,
    stockUnit: z.enum(UNIT_KEYS, { error: 'Unité inconnue' }),
    factor: factorSchema,
    allowsDecimals: z.boolean().default(false),
    clientOperationId: uuid,
  })
  .strict()
  .refine((value) => quantityFitsUnit(value.factor, value.stockUnit), {
    path: ['factor'],
    message: 'Nombre entier attendu pour cette unité',
  });
export type CreateUnitTemplateInput = z.infer<typeof createUnitTemplateSchema>;

/** A template is copied into products: changing it changes no product. */
export const updateUnitTemplateSchema = z
  .object({
    label: unitLabel.optional(),
    allowsDecimals: z.boolean().optional(),
    status: archivableStatus.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à modifier',
  });
export type UpdateUnitTemplateInput = z.infer<typeof updateUnitTemplateSchema>;

export interface UnitTemplateDto {
  id: string;
  label: string;
  stockUnit: Unit;
  factor: number;
  allowsDecimals: boolean;
  status: CatalogStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// What a product is sold in, at the counter (ADR-038)
// ---------------------------------------------------------------------------

export interface UnitConversion {
  code: string;
  label: string;
  /** Stock units in one of it. */
  factor: number;
  decimals: boolean;
}

/**
 * Standard conversions, offered for every product counted in this stock
 * unit without anything to record, priced from the stock unit.
 */
export const UNIT_CONVERSIONS: Partial<
  Record<Unit, readonly UnitConversion[]>
> = {
  kg: [{ code: 'g', label: 'g', factor: 0.001, decimals: false }],
  g: [{ code: 'kg', label: 'kg', factor: 1000, decimals: true }],
  litre: [
    { code: 'cl', label: 'cl', factor: 0.01, decimals: false },
    { code: 'ml', label: 'ml', factor: 0.001, decimals: false },
  ],
  ml: [{ code: 'litre', label: 'litre', factor: 1000, decimals: true }],
  metre: [{ code: 'cm', label: 'cm', factor: 0.01, decimals: false }],
};

export const CONVERSION_CODES = [
  ...new Set(
    Object.values(UNIT_CONVERSIONS).flatMap((list) =>
      (list ?? []).map((c) => c.code),
    ),
  ),
] as [string, ...string[]];

export function conversionOf(
  stockUnit: Unit,
  code: string,
): UnitConversion | null {
  return UNIT_CONVERSIONS[stockUnit]?.find((c) => c.code === code) ?? null;
}

/** One way to sell a product: its stock unit, a conversion or a unit. */
export interface SellingOption {
  /** `stock`, `conversion:g` or `unit:<id>`. */
  key: string;
  productUnitId: string | null;
  conversion: string | null;
  /** Null for the stock unit (its own label is used). */
  label: string | null;
  factor: number;
  allowsDecimals: boolean;
  /** Price of one; null: priced from the stock unit. */
  price: number | null;
}

/** The stock unit first, then the conversions, then the product's units. */
export function sellingOptionsOf(
  product: Pick<ProductDto, 'unit' | 'salePrice' | 'units'>,
): SellingOption[] {
  return [
    {
      key: 'stock',
      productUnitId: null,
      conversion: null,
      label: null,
      factor: 1,
      allowsDecimals: UNITS[product.unit].decimals,
      price: product.salePrice,
    },
    ...(UNIT_CONVERSIONS[product.unit] ?? []).map((c) => ({
      key: `conversion:${c.code}`,
      productUnitId: null,
      conversion: c.code,
      label: c.label,
      factor: c.factor,
      allowsDecimals: c.decimals,
      price: null,
    })),
    ...product.units.map((u) => ({
      key: `unit:${u.id}`,
      productUnitId: u.id,
      conversion: null,
      label: u.label,
      factor: u.factor,
      allowsDecimals: u.allowsDecimals,
      price: u.salePrice,
    })),
  ];
}

/**
 * How a line of `quantity` of this option is priced: a unit with its own
 * price costs that price × quantity; anything else costs the stock unit's
 * price × the stock it takes (« 250 g » of rice at 650 F the kg).
 */
export function pricingOf(
  option: Pick<SellingOption, 'factor' | 'price'>,
  stockPrice: number,
  quantity: number,
): { basis: 'unit' | 'stock'; unitPrice: number; pricedQuantity: number } {
  return option.price !== null
    ? { basis: 'unit', unitPrice: option.price, pricedQuantity: quantity }
    : {
        basis: 'stock',
        unitPrice: stockPrice,
        pricedQuantity: baseQuantityOf(quantity, option.factor) ?? 0,
      };
}

/** Price of one of this option, for display (rounded to the franc). */
export function displayPriceOf(
  option: Pick<SellingOption, 'factor' | 'price'>,
  stockPrice: number,
): number {
  return option.price ?? Math.round(stockPrice * option.factor);
}

export const STOCK_FILTERS = ['low', 'out'] as const;

export const productListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    categoryId: uuid.optional(),
    /** `low`: running low or out of stock; `out`: out of stock. */
    stock: z.enum(STOCK_FILTERS).optional(),
    status: archivableStatus.default('active'),
    kind: z.enum(PRODUCT_KINDS).optional(),
    ...pageFields,
  })
  .strict();
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Photos are resized on the device; the API refuses anything larger. */
export const PRODUCT_PHOTO_MAX_BYTES = 512 * 1024;
export const PRODUCT_PHOTO_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const;
export type ProductPhotoType = (typeof PRODUCT_PHOTO_TYPES)[number];

/** A shop's logo goes into PDFs, which only embed these two (ADR-044). */
export const SHOP_LOGO_TYPES = ['image/png', 'image/jpeg'] as const;
export type ShopLogoType = (typeof SHOP_LOGO_TYPES)[number];

// ---------------------------------------------------------------------------
// Stock movements
// ---------------------------------------------------------------------------

export const STOCK_MOVEMENT_KINDS = [
  'initial',
  'purchase',
  'sale',
  'return',
  'loss',
  'inventory',
  'adjustment',
] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

const reason = z
  .string()
  .trim()
  .min(1, 'Indiquez la raison')
  .max(500, '500 caractères au plus');
const positiveQuantity = quantitySchema.positive(
  'La quantité doit être positive',
);

/**
 * Movements a person records from the product page in Phase 9. Sales and
 * returns come with the sales module (Phase 10).
 */
export const createStockMovementSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('purchase'),
      quantity: positiveQuantity,
      unitCost: amountSchema.nullable().default(null),
      supplierId: uuid.nullable().default(null),
      clientOperationId: uuid,
    })
    .strict(),
  z
    .object({
      kind: z.literal('loss'),
      /** Entered as a positive number; stored as a decrease. */
      quantity: positiveQuantity,
      reason,
      clientOperationId: uuid,
    })
    .strict(),
  z
    .object({
      kind: z.literal('inventory'),
      countedQuantity: quantitySchema.min(
        0,
        'Le compte ne peut pas être négatif',
      ),
      reason: reason.nullable().default(null),
      clientOperationId: uuid,
    })
    .strict(),
]);
export type CreateStockMovementInput = z.infer<
  typeof createStockMovementSchema
>;

export interface StockMovementDto {
  id: string;
  kind: StockMovementKind;
  /** Signed change of the stock. */
  quantity: number;
  countedQuantity: number | null;
  unitCost: number | null;
  supplier: { id: string; name: string } | null;
  reason: string | null;
  createdBy: { userId: string; email: string };
  occurredAt: string;
}

/** Result of recording a movement: the movement and the new stock. */
export interface RecordedStockMovementDto {
  movement: StockMovementDto;
  product: ProductDto;
}

export interface StockAlertDto {
  id: string;
  name: string;
  unit: Unit;
  stockQuantity: number;
  lowStockThreshold: number | null;
  stockLevel: 'low' | 'out';
}

export interface StockSummaryDto {
  trackedProducts: number;
  lowStock: number;
  outOfStock: number;
  /** Stock on hand × purchase price, for products with a purchase price. */
  stockValue: number;
  /** Products in stock without a purchase price (not in `stockValue`). */
  unvaluedProducts: number;
  /** The most urgent alerts, out of stock first. */
  alerts: StockAlertDto[];
}
