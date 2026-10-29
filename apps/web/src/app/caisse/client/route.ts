import { createCustomerSchema, type CustomerDto } from '@nagaw/shared';
import { apiAsUser, getSession } from '@/lib/api/server';

/** Creates a customer from the checkout, on the server at once (ADR-042). */
export async function POST(request: Request) {
  const session = await getSession();
  if (session.status !== 'signed-in')
    return Response.json({ error: 'signed-out' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    organizationId?: unknown;
    customer?: unknown;
  } | null;
  const parsed = createCustomerSchema.safeParse(body?.customer);
  if (!parsed.success || typeof body?.organizationId !== 'string')
    return Response.json(
      {
        error: parsed.error?.issues[0]?.message ?? 'Client incomplet.',
        code: 'VALIDATION_FAILED',
      },
      { status: 400 },
    );
  const result = await apiAsUser<CustomerDto>(session.accessToken, {
    method: 'POST',
    path: '/customers',
    organizationId: body.organizationId,
    body: parsed.data,
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
