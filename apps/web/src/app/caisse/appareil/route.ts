import { registerDeviceSchema, type DeviceDto } from '@nagaw/shared';
import { apiAsUser, getSession } from '@/lib/api/server';

/** Registers this browser as a device of the shop (ADR-020). */
export async function POST(request: Request) {
  const session = await getSession();
  if (session.status !== 'signed-in')
    return Response.json({ error: 'signed-out' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    organizationId?: unknown;
    label?: unknown;
    clientOperationId?: unknown;
  } | null;
  const parsed = registerDeviceSchema.safeParse({
    label: body?.label,
    clientOperationId: body?.clientOperationId,
  });
  if (!parsed.success || typeof body?.organizationId !== 'string')
    return Response.json({ error: 'invalid' }, { status: 400 });
  // The API checks that the user belongs to this shop.
  const result = await apiAsUser<DeviceDto>(session.accessToken, {
    method: 'POST',
    path: '/devices',
    organizationId: body.organizationId,
    body: parsed.data,
  });
  if (!result.ok)
    return Response.json(
      // The code tells the checkout why (limit of the offer, refused).
      { error: result.message, code: result.code },
      { status: result.status || 502 },
    );
  return Response.json(result.data);
}
