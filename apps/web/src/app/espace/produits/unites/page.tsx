import {
  roleHasPermission,
  UNIT_CONVERSIONS,
  UNITS,
  type UnitTemplateDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ArchiveTemplateForm, TemplateForm } from './template-forms';

export const metadata: Metadata = { title: 'Unités — Nagaw Business' };

const quantity = (value: number) =>
  new Intl.NumberFormat('fr', { maximumFractionDigits: 3 }).format(value);

async function Units() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const canManage = roleHasPermission(organization.role, 'catalog.manage');
  const templates = await apiAsUser<UnitTemplateDto[]>(accessToken, {
    path: '/unit-templates',
    organizationId: organization.id,
  });
  return (
    <>
      <PageHeader
        title="Unités"
        description="Les unités que vos produits utilisent souvent (sac de 50 kg, carton de 24, demi-kilo). Ajoutez-les ensuite à un produit en un geste, depuis sa fiche."
      />
      <Card title="Unités automatiques" titleId="automatic">
        <p className="mb-3 text-ink-muted">
          Proposées à la caisse sans rien régler, au prix de l’unité du stock :
        </p>
        <ul className="flex flex-col gap-1">
          {Object.entries(UNIT_CONVERSIONS).map(([unit, conversions]) => (
            <li key={unit}>
              Produits comptés en{' '}
              <strong>{UNITS[unit as keyof typeof UNITS].label}</strong> :
              vendus aussi en{' '}
              {(conversions ?? []).map((c) => c.label).join(', ')}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Modèles de la boutique" titleId="templates">
        {!templates.ok ? (
          <Alert tone="error">
            Modèles indisponibles : {templates.message}
          </Alert>
        ) : templates.data.length === 0 ? (
          <EmptyState title="Aucun modèle pour le moment">
            Ajoutez par exemple « Sac de 50 kg » pour les produits comptés en
            kg.
          </EmptyState>
        ) : (
          <ul
            aria-label="Modèles d’unités"
            className="flex flex-col divide-y divide-line"
          >
            {templates.data.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span>
                  <span className="font-semibold">{template.label}</span>
                  <span className="block text-ink-muted">
                    = {quantity(template.factor)}{' '}
                    {UNITS[template.stockUnit].label}
                    {template.allowsDecimals ? ' · se vend en partie' : ''}
                  </span>
                </span>
                {canManage && (
                  <ArchiveTemplateForm
                    organizationId={organization.id}
                    template={template}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canManage && (
        <Card title="Ajouter un modèle" titleId="add-template">
          <TemplateForm organizationId={organization.id} />
        </Card>
      )}
    </>
  );
}

export default function UnitsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Units />
    </Suspense>
  );
}
