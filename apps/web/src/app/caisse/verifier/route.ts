import { syncCheckSchema, type SyncCheckResponseDto } from '@nagaw/shared';
import { apiAsUser, getSession } from '@/lib/api/server';

/**
 * Asks the API which sales it really holds (ADR-053). The request names
 * its shop: the API checks membership and the device.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (session.status !== 'signed-in')
    return Response.json({ error: 'signed-out' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    organizationId?: unknown;
    deviceId?: unknown;
    clientOperationIds?: unknown;
  } | null;
  const parsed = syncCheckSchema.safeParse({
    deviceId: body?.deviceId,
    clientOperationIds: body?.clientOperationIds,
  });
  if (!parsed.success || typeof body?.organizationId !== 'string')
    return Response.json({ error: 'invalid' }, { status: 400 });
  const result = await apiAsUser<SyncCheckResponseDto>(session.accessToken, {
    method: 'POST',
    path: '/sync/check',
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
