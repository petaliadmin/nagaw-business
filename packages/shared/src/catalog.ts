import { z } from 'zod';
import { MAX_AMOUNT } from './money.js';

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
} as const;
export type Unit = keyof typeof UNITS;
export const UNIT_KEYS = Object.keys(UNITS) as [Unit, ...Unit[]];

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

/** Products counted in whole units (pièce, carton…) refuse decimals. */
export function quantityFitsUnit(quantity: number, unit: Unit): boolean {
  return UNITS[unit].decimals || Number.isInteger(quantity);
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
};

export const createProductSchema = z
  .object({
    ...productFields,
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
  unit: Unit;
  salePrice: number;
  purchasePrice: number | null;
  taxRate: { id: string; name: string; rateBasisPoints: number } | null;
  barcode: string | null;
  trackStock: boolean;
  lowStockThreshold: number | null;
  /** Sum of the stock movements. */
  stockQuantity: number;
  stockLevel: StockLevel;
  status: CatalogStatus;
  version: number;
  /** Changes with the photo (cache key); null without photo. */
  photoVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export const STOCK_FILTERS = ['low', 'out'] as const;

export const productListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    categoryId: uuid.optional(),
    /** `low`: running low or out of stock; `out`: out of stock. */
    stock: z.enum(STOCK_FILTERS).optional(),
    status: archivableStatus.default('active'),
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
