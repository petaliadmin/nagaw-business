import {
  formatAccountPhone,
  formatRate,
  roleHasPermission,
  type DeviceDto,
  type NotificationSettingsDto,
  type OrganizationDto,
  type Role,
  type SubscriptionDto,
  type TaxRateDto,
} from '@nagaw/shared';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Percent,
  Plus,
  Printer,
  Smartphone,
  Store,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { EraseDeviceButton } from '@/components/pwa/erase-device-button';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { logoUrl } from '@/components/ui/shop-logo';
import { apiAsUser } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/call-api';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ReferenceList } from '../produits/reference-page';
import { OrganizationSwitcher } from '@/components/shell/organization-switcher';
import { RestoreDeviceButton, RevokeDeviceButton } from './device-actions';
import { InvoiceSettingsForm } from './invoice-settings-form';
import { LogoForm } from './logo-form';
import { MarkForm } from './mark-form';
import { NotificationSettingsForm } from './notification-settings-form';
import { currencyOptions, timeZoneOptions } from './options';
import { OrganizationSettingsForm } from './organization-settings-form';
import { formatContact } from '@/lib/format';

export const metadata: Metadata = { title: 'Paramètres — Nagaw Business' };

/** Preview in the settings; the version only refreshes the picture. */
const markUrl = (kind: string, version: string | null) =>
  version ? `/espace/parametres/image/${kind}?v=${version}` : null;

/** The sub-pages of the settings (ADR-063), by their address. */
const TITLES = {
  boutique: 'Boutique',
  factures: 'Factures et devis',
  alertes: 'Alertes et stock',
  taxes: 'Taxes',
  appareils: 'Téléphones de caisse',
  telephone: 'Ce téléphone',
  boutiques: 'Mes boutiques',
  profil: 'Mon profil',
} as const;
type Part = keyof typeof TITLES;
const isPart = (value: unknown): value is Part =>
  typeof value === 'string' && value in TITLES;

/** A page the role cannot use falls back on the menu: no empty page. */
function partFor(role: Role, part: Part | null): Part | null {
  if (part === 'alertes' && !roleHasPermission(role, 'organization.update'))
    return null;
  if (part === 'appareils' && !roleHasPermission(role, 'devices.manage'))
    return null;
  if (part === 'factures' && !roleHasPermission(role, 'documents.read'))
    return null;
  return part;
}

interface MenuRow {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The settings as a list of rows (ADR-063): the offer on top, then what
 * concerns the shop, the checkout and the account. Each row opens its page.
 */
function SettingsMenu({
  role,
  plan,
}: {
  role: Role;
  plan: ApiResult<SubscriptionDto> | null;
}) {
  const can = (permission: Parameters<typeof roleHasPermission>[1]) =>
    roleHasPermission(role, permission);
  const groups: { title: string; rows: MenuRow[] }[] = [
    {
      title: 'Boutique',
      rows: [
        {
          href: '/espace/parametres?partie=boutique',
          label: 'Nom, devise et fuseau horaire',
          icon: Store,
        },
        ...(can('documents.read')
          ? [
              {
                href: '/espace/parametres?partie=factures',
                label: 'Factures et devis : logo, cachet, couleurs',
                icon: FileText,
              },
            ]
          : []),
        ...(can('organization.update')
          ? [
              {
                href: '/espace/parametres?partie=alertes',
                label: 'Alertes et stock',
                icon: BellRing,
              },
            ]
          : []),
        {
          href: '/espace/parametres?partie=taxes',
          label: 'Taxes',
          icon: Percent,
        },
        ...(can('members.read')
          ? [{ href: '/espace/equipe', label: 'Équipe', icon: Users }]
          : []),
        ...(can('audit.read')
          ? [{ href: '/espace/journal', label: 'Historique', icon: History }]
          : []),
      ],
    },
    {
      title: 'Caisse',
      rows: [
        ...(can('devices.manage')
          ? [
              {
                href: '/espace/parametres?partie=appareils',
                label: 'Téléphones de caisse',
                icon: Smartphone,
              },
            ]
          : []),
        {
          href: '/espace/parametres?partie=telephone',
          label: 'Ce téléphone : imprimante, ventes gardées',
          icon: Printer,
        },
      ],
    },
    {
      title: 'Compte',
      rows: [
        {
          href: '/espace/parametres?partie=boutiques',
          label: 'Mes boutiques',
          icon: Store,
        },
        {
          href: '/espace/parametres?partie=profil',
          label: 'Mon profil',
          icon: UserRound,
        },
      ],
    },
  ];
  return (
    <>
      {plan && (
        <Link
          href="/espace/abonnement"
          className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-canvas"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-bold text-[#c9c5ff]">
              Votre offre
            </span>
            <span className="text-xl font-extrabold">
              {plan.ok ? plan.data.plan.name : 'Abonnement'}
            </span>
          </span>
          <span className="inline-flex min-h-12 items-center rounded-full bg-canvas px-5 font-extrabold text-ink">
            Changer
          </span>
        </Link>
      )}
      {groups.map((group) => (
        <section
          key={group.title}
          aria-labelledby={`settings-${group.title}`}
          className="flex flex-col gap-2"
        >
          <h2
            id={`settings-${group.title}`}
            className="text-sm font-extrabold text-ink-muted"
          >
            {group.title}
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface px-4">
            {group.rows.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-16 items-center gap-3 py-2 font-bold"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-canvas">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">{label}</span>
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-ink-muted"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

async function Settings({ partie: asked }: { partie?: string }) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization: active, accessToken, me } = workspace;
  const partie = partFor(active.role, isPart(asked) ? asked : null);

  // Fresh read, so the form never starts from stale values.
  const canManageDevices = roleHasPermission(active.role, 'devices.manage');
  const canUpdate = roleHasPermission(active.role, 'organization.update');
  const [organization, taxRates, devices, alerts, plan] = await Promise.all([
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
    canUpdate
      ? apiAsUser<NotificationSettingsDto>(accessToken, {
          path: '/notifications/settings',
          organizationId: active.id,
        })
      : null,
    !partie && roleHasPermission(active.role, 'subscription.read')
      ? apiAsUser<SubscriptionDto>(accessToken, {
          path: '/subscription',
          organizationId: active.id,
        })
      : null,
  ]);
  const when = (iso: string) =>
    new Intl.DateTimeFormat('fr', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: active.timezone,
    }).format(new Date(iso));

  return (
    <>
      <PageHeader title={partie ? TITLES[partie] : 'Paramètres'} />
      {partie && (
        <Link
          href="/espace/parametres"
          className="inline-flex min-h-12 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 font-bold"
        >
          <ChevronLeft aria-hidden className="size-6" />
          Tous les paramètres
        </Link>
      )}
      {!partie && <SettingsMenu role={active.role} plan={plan} />}
      {partie === 'boutique' && (
        <>
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
                  <Stat
                    label="Fuseau horaire"
                    value={organization.data.timezone}
                  />
                  <Stat
                    label="Devise"
                    value={organization.data.defaultCurrency}
                  />
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
        </>
      )}
      {partie === 'factures' && (
        <>
          {organization.ok &&
            roleHasPermission(active.role, 'documents.read') && (
              <Card
                title="Factures et devis"
                titleId="invoice-settings"
                icon={FileText}
              >
                <p className="mb-4 text-ink-muted">
                  Ces informations sont imprimées sur vos factures et vos devis.
                </p>
                {canUpdate ? (
                  <div className="flex flex-col gap-6">
                    <LogoForm
                      organizationId={organization.data.id}
                      currentUrl={logoUrl(organization.data.logoVersion)}
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <MarkForm
                        organizationId={organization.data.id}
                        kind="stamp"
                        currentUrl={markUrl(
                          'stamp',
                          organization.data.stampVersion,
                        )}
                      />
                      <MarkForm
                        organizationId={organization.data.id}
                        kind="signature"
                        currentUrl={markUrl(
                          'signature',
                          organization.data.signatureVersion,
                        )}
                      />
                    </div>
                    <p className="text-ink-muted">
                      Le cachet et la signature sont imprimés sur vos factures
                      émises, jamais sur un brouillon.
                    </p>
                    <InvoiceSettingsForm organization={organization.data} />
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Stat
                      label="Raison sociale"
                      value={
                        organization.data.legalName || organization.data.name
                      }
                    />
                    <Stat
                      label="NINEA"
                      value={organization.data.taxId || '—'}
                    />
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
        </>
      )}
      {partie === 'alertes' && (
        <>
          {alerts && (
            <Card title="Alertes et stock" titleId="alerts" icon={BellRing}>
              <p className="mb-4 text-ink-muted">
                Ce qui déclenche vos notifications, et ce que les vendeurs
                peuvent corriger à la caisse. Chacun choisit ensuite ce qu’il
                reçoit dans{' '}
                <Link
                  href="/espace/notifications/reglages"
                  className="font-bold text-brand-ink underline underline-offset-4"
                >
                  Notifications
                </Link>
                .
              </p>
              {alerts.ok ? (
                <NotificationSettingsForm
                  organizationId={active.id}
                  settings={alerts.data}
                />
              ) : (
                <Alert tone="error">
                  Réglages indisponibles : {alerts.message}
                </Alert>
              )}
            </Card>
          )}
        </>
      )}
      {partie === 'appareils' && (
        <>
          {devices && (
            <Card
              title="Appareils de vente"
              titleId="devices"
              icon={Smartphone}
            >
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
                        {formatContact(device.user.email)}
                        {device.lastSyncedAt
                          ? ` · dernier envoi le ${when(device.lastSyncedAt)}`
                          : ' · aucun envoi'}
                      </span>
                      {device.revokedAt ? (
                        <>
                          <span className="font-semibold text-danger-ink">
                            Retiré le {when(device.revokedAt)}
                          </span>
                          <RestoreDeviceButton
                            organizationId={active.id}
                            deviceId={device.id}
                            label={device.label}
                          />
                        </>
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
        </>
      )}
      {partie === 'telephone' && (
        <>
          <Card title="Ce téléphone" titleId="this-device" icon={Smartphone}>
            <div className="flex flex-col gap-3">
              <p className="text-ink-muted">
                Il garde les produits, les clients et les ventes de la boutique,
                même après une déconnexion. Videz-le seulement s’il change de
                propriétaire.
              </p>
              <EraseDeviceButton />
            </div>
          </Card>
        </>
      )}
      {partie === 'taxes' && (
        <>
          <section
            aria-labelledby="taxes-title"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id="taxes-title" className="text-xl font-bold">
                Taxes
              </h2>
              <p className="text-ink-muted">
                Les prix de vente sont affichés taxes comprises. Indiquez ici
                les taux que vous appliquez (par exemple la TVA à 18 %).
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
        </>
      )}
      {partie === 'boutiques' && (
        <>
          <Card title="Mes boutiques" titleId="shops" icon={Store}>
            <div className="flex flex-col gap-4">
              {me.organizations.length > 1 ? (
                <OrganizationSwitcher
                  organizations={me.organizations}
                  activeId={active.id}
                />
              ) : (
                <p>
                  Boutique ouverte : <strong>{active.name}</strong>.
                </p>
              )}
              <p className="text-ink-muted">
                Vous avez un autre magasin ? Créez une boutique séparée : ses
                produits, ses ventes et son équipe restent à part.
              </p>
              <div>
                <ButtonLink
                  href="/espace/nouvelle-boutique"
                  variant="secondary"
                >
                  <Plus aria-hidden className="size-5" />
                  Créer une autre boutique
                </ButtonLink>
              </div>
            </div>
          </Card>
        </>
      )}
      {partie === 'profil' && (
        <>
          <Card title="Mon profil" titleId="profile" icon={UserRound}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Stat
                label="Numéro de téléphone"
                value={me.phone ? formatAccountPhone(me.phone) : 'Pas encore'}
              />
              {me.email && <Stat label="Adresse e-mail" value={me.email} />}
              <Stat label="Langue" value="Français" />
            </dl>
          </Card>
        </>
      )}
    </>
  );
}

export default async function SettingsPage({
  searchParams,
}: PageProps<'/espace/parametres'>) {
  const { partie } = await searchParams;
  return (
    <Suspense fallback={<PageFallback variant="form" />}>
      <Settings partie={typeof partie === 'string' ? partie : undefined} />
    </Suspense>
  );
}
