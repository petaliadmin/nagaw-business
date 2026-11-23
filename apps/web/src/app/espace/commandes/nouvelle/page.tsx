import {
  roleHasPermission,
  type CustomerDto,
  type ProductDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { todayIn } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { OrderForm } from '../order-form';

export const metadata: Metadata = {
  title: 'Nouvelle commande — Nagaw Business',
};

async function NewOrder() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const header = <PageHeader title="Nouvelle commande" />;
  if (
    !organization.ordersEnabled ||
    !roleHasPermission(organization.role, 'orders.manage')
  )
    return (
      <>
        {header}
        <Alert>
          {organization.ordersEnabled
            ? 'Votre rôle ne permet pas de prendre une commande.'
            : 'Les commandes ne sont pas activées : Paramètres › Mon application.'}
        </Alert>
      </>
    );
  const [customers, products] = await Promise.all([
    apiAsUser<CustomerDto[]>(accessToken, {
      path: '/customers?limit=100',
      organizationId: organization.id,
    }),
    apiAsUser<ProductDto[]>(accessToken, {
      path: '/products?limit=100',
      organizationId: organization.id,
    }),
  ]);
  if (!customers.ok || !products.ok) {
    const failed = !customers.ok ? customers : products;
    return (
      <>
        {header}
        <Alert tone="error">
          Formulaire indisponible : {!failed.ok && failed.message}
        </Alert>
      </>
    );
  }
  return (
    <>
      {header}
      <OrderForm
        organizationId={organization.id}
        currency={organization.defaultCurrency}
        today={todayIn(organization.timezone)}
        customers={customers.data}
        products={products.data}
      />
    </>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<PageFallback variant="form" />}>
      <NewOrder />
    </Suspense>
  );
}
