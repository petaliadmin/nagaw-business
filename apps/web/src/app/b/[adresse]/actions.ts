'use server';

import { publicOrderSchema, type PublicOrderResultDto } from '@nagaw/shared';
import { headers } from 'next/headers';
import { apiPublic } from '@/lib/api/server';
import { storefrontRelaySecret } from '@/lib/env';

/** Ma vitrine (ADR-075): what a visitor sends, without a session. */

export type SendOrderResult =
  | { ok: true; order: PublicOrderResultDto }
  | {
      ok: false;
      message: string;
      fields?: Record<string, string>;
    };

/** The visitor's address, relayed to the API behind the shared secret. */
async function relay(): Promise<Record<string, string>> {
  const secret = storefrontRelaySecret();
  if (!secret) return {};
  const list = (await headers()).get('x-forwarded-for') ?? '';
  const visitor = list.split(',')[0]?.trim() ?? '';
  return visitor
    ? { 'X-Storefront-Relay': secret, 'X-Storefront-Visitor': visitor }
    : {};
}

export async function sendStorefrontOrder(
  slug: string,
  values: unknown,
): Promise<SendOrderResult> {
  const parsed = publicOrderSchema.safeParse(values);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return { ok: false, message: 'Vérifiez ce qui est en rouge.', fields };
  }
  const result = await apiPublic<PublicOrderResultDto>(
    `/public/storefronts/${encodeURIComponent(slug)}/orders`,
    { method: 'POST', body: parsed.data, extraHeaders: await relay() },
  );
  if (result.ok) return { ok: true, order: result.data };
  if (result.code === 'API_UNREACHABLE' || result.status === 0)
    return {
      ok: false,
      message:
        'Pas de connexion : votre commande n’est pas partie. Réessayez quand le réseau revient.',
    };
  const fields: Record<string, string> = {};
  for (const detail of result.details ?? [])
    fields[detail.path] = detail.message;
  return { ok: false, message: result.message, fields };
}

/** One visit, counted without cookie or address. */
export async function countStorefrontVisit(slug: string): Promise<void> {
  const result = await apiPublic<null>(
    `/public/storefronts/${encodeURIComponent(slug)}/visits`,
    { method: 'POST' },
  );
  // A visit not counted changes nothing for the visitor.
  if (!result.ok)
    console.error('Visite de vitrine non comptée', slug, result.code);
}
