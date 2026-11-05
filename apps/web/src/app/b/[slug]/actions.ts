'use server';

import { publicOrderSchema, type PublicOrderReceiptDto } from '@nagaw/shared';
import { apiPublic } from '@/lib/api/server';

export type PlaceOrderResult =
  | { ok: true; receipt: PublicOrderReceiptDto }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
      /** The prices moved: the page reloads them. */
      priceChanged?: boolean;
    };

/** Sends the order of a customer, without account (ADR-063). */
export async function placeOrder(
  slug: string,
  input: unknown,
): Promise<PlaceOrderResult> {
  const parsed = publicOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      ok: false,
      message: 'Vérifiez les champs en rouge.',
      fieldErrors,
    };
  }
  // The API checks the shop, the products, the prices and the limits.
  const result = await apiPublic<PublicOrderReceiptDto>(
    `/public/shops/${encodeURIComponent(slug)}/orders`,
    { method: 'POST', body: parsed.data },
  );
  if (result.ok) return { ok: true, receipt: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const detail of result.details ?? []) {
    const field = detail.path.split('.')[0] ?? '';
    if (field && !fieldErrors[field]) fieldErrors[field] = detail.message;
  }
  return {
    ok: false,
    message: result.message,
    fieldErrors,
    priceChanged: result.code === 'PRICE_CHANGED',
  };
}
