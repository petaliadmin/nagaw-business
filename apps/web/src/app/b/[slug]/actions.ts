'use server';

import {
  publicOrderSchema,
  type PublicOrderReceiptDto,
  type WaveLaunchDto,
} from '@nagaw/shared';
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

/**
 * The Wave page of an order (ADR-065). The browser opens it itself: inside
 * an app webview the jump to the Wave app would fail (Wave docs).
 */
export async function launchWave(
  slug: string,
  orderId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const result = await apiPublic<WaveLaunchDto>(
    `/public/shops/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderId)}/wave`,
    { method: 'POST' },
  );
  if (!result.ok) return { ok: false, message: result.message };
  // Only a Wave page: never send the customer elsewhere.
  if (!/^https:\/\/([a-z0-9-]+\.)*wave\.com\//.test(result.data.launchUrl))
    return { ok: false, message: 'Lien Wave invalide. Payez avec le numéro.' };
  return { ok: true, url: result.data.launchUrl };
}
