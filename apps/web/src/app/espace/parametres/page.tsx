import {
  formatRate,
  roleHasPermission,
  type DeviceDto,
  type OrganizationDto,
  type TaxRateDto,
} from '@nagaw/shared';
import { FileText, Smartphone, Store, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ReferenceList } from '../produits/reference-page';
import { RevokeDeviceButton } from './device-actions';
import { InvoiceSettingsForm } from './invoice-settings-form';
import { currencyOptions, timeZoneOptions } from './options';
import { OrganizationSettingsForm } from './organization-settings-form';

export const metadata: Metadata = { title: 'Paramètres — Nagaw Business' };

async function Settings() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization: active, accessToken, me } = workspace;

  // Fresh read, so the form never starts from stale values.
  const canManageDevices = roleHasPermission(active.role, 'devices.manage');
  const [organization, taxRates, devices] = await Promise.all([
    apiAsUser<OrganizationDto>(accessToken, {
      path: '/organizations/current',
      organizationId: active.id,
    }),
    apiAsUser<TaxRateDto[]>(accessToken, {
      path: '/tax-rates',
      organizationId: active.id,
    }),
    canManageDevices
      ? apiAsUser<DeviceDto[]>(accessToken, {
          path: '/devices',
          organizationId: active.id,
        })
      : null,
  ]);
  const canUpdate = roleHasPermission(active.role, 'organization.update');
  const when = (iso: string) =>
    new Intl.DateTimeFormat('fr', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: active.timezone,
    }).format(new Date(iso));

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
      {organization.ok && roleHasPermission(active.role, 'documents.read') && (
        <Card
          title="Factures et devis"
          titleId="invoice-settings"
          icon={FileText}
        >
          <p className="mb-4 text-ink-muted">
            Ces informations sont imprimées sur vos factures et vos devis.
          </p>
          {canUpdate ? (
            <InvoiceSettingsForm organization={organization.data} />
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Stat
                label="Raison sociale"
                value={organization.data.legalName || organization.data.name}
              />
              <Stat label="NINEA" value={organization.data.taxId || '—'} />
              <Stat
                label="Délai de paiement"
                value={`${organization.data.invoiceDueDays} jours`}
              />
              <Stat
                label="Validité des devis"
                value={`${organization.data.quoteValidityDays} jours`}
              />
            </dl>
          )}
        </Card>
      )}
      {devices && (
        <Card title="Appareils de vente" titleId="devices" icon={Smartphone}>
          {!devices.ok ? (
            <Alert tone="error">
              Appareils indisponibles : {devices.message}
            </Alert>
          ) : devices.data.length === 0 ? (
            <p className="text-ink-muted">
              Un appareil apparaît ici dès qu’il ouvre la caisse.
            </p>
          ) : (
            <ul
              aria-label="Appareils de vente"
              className="flex flex-col divide-y divide-line"
            >
              {devices.data.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-col gap-2 py-3 first:pt-0"
                >
                  <span className="font-semibold">
                    {device.label} — tickets {device.ticketPrefix}-…
                  </span>
                  <span className="text-ink-muted">
                    {device.user.email}
                    {device.lastSyncedAt
                      ? ` · dernier envoi le ${when(device.lastSyncedAt)}`
                      : ' · aucun envoi'}
                  </span>
                  {device.revokedAt ? (
                    <span className="font-semibold text-danger-ink">
                      Retiré le {when(device.revokedAt)}
                    </span>
                  ) : (
                    <RevokeDeviceButton
                      organizationId={active.id}
                      deviceId={device.id}
                      label={device.label}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
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
