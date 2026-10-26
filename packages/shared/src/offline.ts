import { z } from 'zod';
import { amountSchema, quantitySchema } from './catalog.js';
import { createCustomerSchema, paymentSchema } from './sales.js';

const uuid = z.uuid('Identifiant invalide');

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

/** 1 → A, 26 → Z, 27 → AA: the ticket prefix of the n-th device. */
export function deviceTicketPrefix(n: number): string {
  let value = n;
  let prefix = '';
  while (value > 0) {
    const rest = (value - 1) % 26;
    prefix = String.fromCharCode(65 + rest) + prefix;
    value = Math.floor((value - 1) / 26);
  }
  return prefix;
}

/** `B-000012`: ticket number printed by a device while offline. */
export function formatDeviceTicket(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(6, '0')}`;
}

export const registerDeviceSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'Donnez un nom à cet appareil')
      .max(60, '60 caractères au plus'),
    clientOperationId: uuid,
  })
  .strict();
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export interface DeviceDto {
  id: string;
  label: string;
  ticketPrefix: string;
  user: { userId: string; email: string };
  lastSyncedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Synchronization (ADR-020)
// ---------------------------------------------------------------------------

/**
 * A sale recorded on the device. Unlike an online sale, it carries the
 * prices the seller saw: the customer has already paid them. The server
 * recomputes the totals from these prices and flags the sale when they
 * differ from the catalogue (ADR-025).
 */
export const offlineSaleSchema = z
  .object({
    deviceTicket: z
      .string()
      .regex(/^[A-Z]{1,3}-\d{6}$/, 'Numéro de ticket invalide'),
    /** Device time of the sale. */
    occurredAt: z.iso.datetime({ offset: true, error: 'Date invalide' }),
    /** A customer known by the server… */
    customerId: uuid.nullable().default(null),
    /** …or one created offline in the same batch (its operation id). */
    customerOperationId: uuid.nullable().default(null),
    lines: z
      .array(
        z
          .object({
            productId: uuid,
            quantity: quantitySchema.positive('La quantité doit être positive'),
            unitPrice: amountSchema,
          })
          .strict(),
      )
      .min(1, 'Le panier est vide')
      .max(200, '200 articles au plus'),
    discount: amountSchema.default(0),
    payments: z.array(paymentSchema).min(1).max(5),
    cashReceived: amountSchema.nullable().default(null),
  })
  .strict()
  .refine((sale) => !(sale.customerId && sale.customerOperationId), {
    path: ['customerOperationId'],
    message: 'Un seul client par vente',
  });
export type OfflineSaleInput = z.infer<typeof offlineSaleSchema>;

/**
 * A stock correction made at the counter when the shelf holds more (or
 * less) than the phone thinks (ADR-036). It carries the change, not the
 * count: sales sent meanwhile by other phones stay counted.
 */
export const stockCorrectionSchema = z
  .object({
    productId: uuid,
    /** Signed change of the stock, never 0. */
    quantity: quantitySchema.refine((q) => q !== 0, 'La correction est nulle'),
    /** What the seller counted, for the managers (not applied as is). */
    countedQuantity: quantitySchema.min(
      0,
      'Le compte ne peut pas être négatif',
    ),
    reason: z
      .string()
      .trim()
      .min(1, 'Indiquez la raison')
      .max(500, '500 caractères au plus'),
    occurredAt: z.iso.datetime({ offset: true, error: 'Date invalide' }),
  })
  .strict();
export type StockCorrectionInput = z.infer<typeof stockCorrectionSchema>;

const offlineCustomerSchema = createCustomerSchema.omit({
  clientOperationId: true,
});

export const syncOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('customer'),
      clientOperationId: uuid,
      data: offlineCustomerSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('sale'),
      clientOperationId: uuid,
      data: offlineSaleSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('stock_correction'),
      clientOperationId: uuid,
      data: stockCorrectionSchema,
    })
    .strict(),
]);
export type SyncOperation = z.infer<typeof syncOperationSchema>;

/** Operations are applied in order: a sale may follow its new customer. */
export const syncRequestSchema = z
  .object({
    deviceId: uuid,
    operations: z.array(syncOperationSchema).min(1).max(50),
  })
  .strict();
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export type SyncStatus = 'accepted' | 'duplicate' | 'rejected';

export interface SyncResultDto {
  clientOperationId: string;
  status: SyncStatus;
  /** For a sale. */
  saleId?: string;
  saleNumber?: number;
  /** A sale accepted at prices that differ from the catalogue. */
  priceReview?: boolean;
  /** A sale that took more goods than the server's stock. */
  stockReview?: boolean;
  /** For a stock correction: the stock after it. */
  stockQuantity?: number;
  /** For a customer. */
  customerId?: string;
  /** Why an operation was refused (kept on the device, shown to people). */
  error?: { code: string; message: string };
}

export interface SyncResponseDto {
  results: SyncResultDto[];
}
