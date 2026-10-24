import { syncRequestSchema, type SyncResponseDto } from '@nagaw/shared';
import { apiAsUser, getSession } from '@/lib/api/server';

/**
 * Forwards a batch of offline operations to the API with the user's
 * session. The batch names its shop: the API checks membership, the device
 * and every operation (ADR-020).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (session.status !== 'signed-in')
    return Response.json({ error: 'signed-out' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    organizationId?: unknown;
    deviceId?: unknown;
    operations?: unknown;
  } | null;
  const parsed = syncRequestSchema.safeParse({
    deviceId: body?.deviceId,
    operations: body?.operations,
  });
  if (!parsed.success || typeof body?.organizationId !== 'string')
    return Response.json({ error: 'invalid' }, { status: 400 });
  const result = await apiAsUser<SyncResponseDto>(session.accessToken, {
    method: 'POST',
    path: '/sync',
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
