import { createSaleSchema, type SaleDto } from '@nagaw/shared';
import { apiAsUser, getSession } from '@/lib/api/server';

/**
 * Records a sale of the checkout on the server, at once (ADR-042: the
 * offline checkout is paused). The API checks the shop, the prices, the
 * stock and the seller's rights; its refusal goes back to the seller.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (session.status !== 'signed-in')
    return Response.json({ error: 'signed-out' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    organizationId?: unknown;
    sale?: unknown;
  } | null;
  const parsed = createSaleSchema.safeParse(body?.sale);
  if (!parsed.success || typeof body?.organizationId !== 'string')
    return Response.json(
      {
        error:
          parsed.error?.issues[0]?.message ??
          'Vente incomplète : rechargez la caisse.',
        code: 'VALIDATION_FAILED',
      },
      { status: 400 },
    );
  const result = await apiAsUser<SaleDto>(session.accessToken, {
    method: 'POST',
    path: '/sales',
    organizationId: body.organizationId,
    body: parsed.data,
    timeoutMs: 20000,
  });
  if (!result.ok)
    return Response.json(
      { error: result.message, code: result.code },
      { status: result.status || 502 },
    );
  return Response.json(result.data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
