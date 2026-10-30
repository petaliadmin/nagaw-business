import type {
  CustomerDto,
  DeviceDto,
  NotificationSettingsDto,
  ProductDto,
} from '@nagaw/shared';
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
  const [products, customers, devices, settings] = await Promise.all([
    call<ProductDto[]>('/products'),
    call<CustomerDto[]>('/customers'),
    call<DeviceDto[]>('/devices'),
    call<NotificationSettingsDto>('/notifications/settings'),
  ]);
  if (!products.ok || !customers.ok || !devices.ok || !settings.ok) {
    const failed = [products, customers, devices, settings].find((r) => !r.ok);
    return Response.json(
      { error: failed && !failed.ok ? failed.message : 'API indisponible' },
      { status: failed && !failed.ok && failed.status === 403 ? 403 : 502 },
    );
  }
  return Response.json(
    {
      organizationId: organization.id,
      // Whose phone it is now: another account may have sold on it before.
      user: { id: workspace.me.id, email: workspace.me.email },
      shop: {
        name: organization.name,
        currency: organization.defaultCurrency,
        timeZone: organization.timezone,
        role: organization.role,
        offer: organization.offer,
        logoVersion: organization.logoVersion,
      },
      products: products.data,
      customers: customers.data,
      rules: {
        stockCorrectionMax: settings.data.sellerStockCorrectionMax,
        sellerCanSellBelowCost: settings.data.sellerCanSellBelowCost,
        // This person's own limit in this shop (ADR-038).
        maxDiscountBasisPoints: organization.maxDiscountBasisPoints,
      },
      devices: devices.data.filter(
        (d) => !d.revokedAt && d.user.userId === workspace.me.id,
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
