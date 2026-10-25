import 'server-only';
import type { CustomerDto, ProductDto, TaxRateDto } from '@nagaw/shared';
import { apiAsUser } from '@/lib/api/server';
import type { EditorProduct } from './document-editor';

/** Customers, products and tax rates the editor offers. */
export async function loadEditorData(
  accessToken: string,
  organizationId: string,
) {
  const [customers, products, taxRates] = await Promise.all([
    apiAsUser<CustomerDto[]>(accessToken, {
      path: '/customers',
      organizationId,
    }),
    apiAsUser<ProductDto[]>(accessToken, { path: '/products', organizationId }),
    apiAsUser<TaxRateDto[]>(accessToken, {
      path: '/tax-rates',
      organizationId,
    }),
  ]);
  if (!customers.ok) return { ok: false as const, message: customers.message };
  if (!products.ok) return { ok: false as const, message: products.message };
  if (!taxRates.ok) return { ok: false as const, message: taxRates.message };
  return {
    ok: true as const,
    customers: customers.data
      .filter((c) => c.status === 'active')
      .map((c) => ({ id: c.id, name: c.name })),
    products: products.data.map((p): EditorProduct => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      salePrice: p.salePrice,
      taxRateBasisPoints: p.taxRate?.rateBasisPoints ?? null,
    })),
    taxRates: taxRates.data
      .filter((t) => t.status === 'active')
      .map((t) => ({ name: t.name, rateBasisPoints: t.rateBasisPoints })),
  };
}
