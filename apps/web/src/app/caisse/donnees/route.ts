import type { CustomerDto, DeviceDto, ProductDto } from '@nagaw/shared';
import { apiAsUser } from '@/lib/api/server';
import { loadWorkspace } from '@/lib/workspace/load';

/**
 * What the offline checkout keeps on the device for the active shop: its
 * products, customers and this user's devices. Never cached by the browser.
 */
export async function GET() {
  const workspace = await loadWorkspace();
  if (workspace.status !== 'ready')
    return Response.json({ error: workspace.status }, { status: 401 });
  const { organization, accessToken } = workspace;
  const call = <T>(path: string) =>
    apiAsUser<T>(accessToken, { path, organizationId: organization.id });
  const [products, customers, devices] = await Promise.all([
    call<ProductDto[]>('/products'),
    call<CustomerDto[]>('/customers'),
    call<DeviceDto[]>('/devices'),
  ]);
  if (!products.ok || !customers.ok || !devices.ok) {
    const failed = [products, customers, devices].find((r) => !r.ok);
    return Response.json(
      { error: failed && !failed.ok ? failed.message : 'API indisponible' },
      { status: failed && !failed.ok && failed.status === 403 ? 403 : 502 },
    );
  }
  return Response.json(
    {
      organizationId: organization.id,
      shop: {
        name: organization.name,
        currency: organization.defaultCurrency,
        timeZone: organization.timezone,
        role: organization.role,
      },
      products: products.data,
      customers: customers.data,
      devices: devices.data.filter(
        (d) => !d.revokedAt && d.user.userId === workspace.me.id,
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
