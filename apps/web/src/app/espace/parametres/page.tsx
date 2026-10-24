import {
  formatRate,
  roleHasPermission,
  type OrganizationDto,
  type TaxRateDto,
} from '@nagaw/shared';
import { Store, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ReferenceList } from '../produits/reference-page';
import { currencyOptions, timeZoneOptions } from './options';
import { OrganizationSettingsForm } from './organization-settings-form';

export const metadata: Metadata = { title: 'Paramètres — Nagaw Business' };

async function Settings() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization: active, accessToken, me } = workspace;

  // Fresh read, so the form never starts from stale values.
  const [organization, taxRates] = await Promise.all([
    apiAsUser<OrganizationDto>(accessToken, {
      path: '/organizations/current',
      organizationId: active.id,
    }),
    apiAsUser<TaxRateDto[]>(accessToken, {
      path: '/tax-rates',
      organizationId: active.id,
    }),
  ]);
  const canUpdate = roleHasPermission(active.role, 'organization.update');

  return (
    <>
      <PageHeader title="Paramètres" />
      <Card title="Boutique" titleId="org-settings" icon={Store}>
        {!organization.ok ? (
          <Alert tone="error">
            Paramètres indisponibles : {organization.message}
          </Alert>
        ) : canUpdate ? (
          <OrganizationSettingsForm
            organization={organization.data}
            timeZones={timeZoneOptions(organization.data.timezone)}
            currencies={currencyOptions(organization.data.defaultCurrency)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Stat label="Nom" value={organization.data.name} />
              <Stat label="Fuseau horaire" value={organization.data.timezone} />
              <Stat label="Devise" value={organization.data.defaultCurrency} />
              <Stat
                label="Validité des invitations"
                value={`${organization.data.invitationTtlHours} h`}
              />
            </dl>
            <Alert>
              Seuls le propriétaire et les gérants peuvent modifier ces
              paramètres.
            </Alert>
          </div>
        )}
      </Card>
      <section aria-labelledby="taxes-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="taxes-title" className="text-xl font-bold">
            Taxes
          </h2>
          <p className="text-ink-muted">
            Les prix de vente sont affichés taxes comprises. Indiquez ici les
            taux que vous appliquez (par exemple la TVA à 18 %).
          </p>
        </div>
        <ReferenceList
          kind="taxRate"
          workspace={workspace}
          items={taxRates}
          addTitle="Ajouter une taxe"
          addLabel="Ajouter la taxe"
          emptyTitle="Aucune taxe enregistrée"
          listLabel="Taxes"
          describe={(tax) => formatRate(tax.rateBasisPoints)}
        />
      </section>
      <Card title="Mon profil" titleId="profile" icon={UserRound}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat label="Adresse e-mail" value={me.email} />
          <Stat label="Langue" value="Français" />
        </dl>
      </Card>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Settings />
    </Suspense>
  );
}
