import {
  sellingOptionsOf,
  type ProductDto,
  type SellingOption,
} from '@nagaw/shared';

/** What a scanned code sells: the product and the unit the code names. */
export interface CodeMatch {
  product: ProductDto;
  option: SellingOption;
}

/**
 * The product a code names, read by a reader or the camera (barcode or QR
 * code holding the same text). The product's own code sells its stock
 * unit; a unit's code (« carton de 24 ») sells that unit (ADR-038). Codes
 * are unique in a shop, products and units together.
 */
export function findByCode(
  products: readonly ProductDto[],
  raw: string,
): CodeMatch | null {
  const code = raw.trim();
  if (code === '') return null;
  for (const product of products) {
    const options = sellingOptionsOf(product);
    if (product.barcode === code) return { product, option: options[0]! };
    const unit = product.units.find((u) => u.barcode === code);
    if (!unit) continue;
    const option = options.find((o) => o.productUnitId === unit.id);
    if (option) return { product, option };
  }
  return null;
}

/**
 * The camera sees a code several times a second: it counts once while it
 * stays in view, and again only after it has been out of view this long
 * (the next box of the same product).
 */
export const SAME_CODE_PAUSE_MS = 800;

/** The last code seen, and when it was last in view. */
export interface LastSeen {
  code: string;
  seenAt: number;
}

/** Whether a code in view now is a new read, not the same box still there. */
export function isNewRead(
  code: string,
  last: LastSeen | null,
  now: number,
): boolean {
  return !last || last.code !== code || now - last.seenAt >= SAME_CODE_PAUSE_MS;
}
