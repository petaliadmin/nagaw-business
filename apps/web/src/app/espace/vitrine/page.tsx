import { roleHasPermission, type StorefrontSettingsDto } from '@nagaw/shared';
import { Globe, ListChecks, Share2, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { siteUrl } from '@/lib/env';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { PresentationForm, ShareActions, SwitchForm } from './storefront-forms';

export const metadata: Metadata = { title: 'Ma vitrine — Nagaw Business' };

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm text-white/80">{label}</p>
    </div>
  );
}

async function Storefront() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  if (!roleHasPermission(organization.role, 'storefront.manage'))
    redirect('/espace/commandes');
  const result = await apiAsUser<StorefrontSettingsDto>(accessToken, {
    path: '/storefront',
    organizationId: organization.id,
  });
  if (!result.ok)
    return <Alert tone="error">Vitrine indisponible : {result.message}</Alert>;
  const settings = result.data;
  const site = siteUrl();
  const url = settings.slug ? `${site}/b/${settings.slug}` : null;

  return (
    <>
      <PageHeader
        title="Ma vitrine"
        description="Votre catalogue en lien, à partager sur votre statut et vos réseaux. Les clients commandent, vous confirmez, ils paient en venant chercher."
      />

      {settings.enabled ? (
        <section
          aria-label="Ma vitrine cette semaine"
          className="flex flex-col gap-3 rounded-3xl bg-ink p-5 text-white"
        >
          <p className="text-sm text-white/80">Les 7 derniers jours</p>
          <div className="grid grid-cols-3 gap-2">
            <Figure value={settings.week.visits} label="visites" />
            <Figure value={settings.week.ordersSent} label="commandes" />
            <Figure value={settings.week.ordersAccepted} label="acceptées" />
          </div>
          {settings.toConfirm > 0 && (
            <ButtonLink
              href="/espace/commandes"
              variant="outlineOnDark"
              className="self-start"
            >
              {settings.toConfirm} à confirmer
            </ButtonLink>
          )}
        </section>
      ) : (
        <Alert>
          Votre vitrine est éteinte. En la mettant en ligne, les commandes
          s’allument aussi : elles arrivent dans Commandes, à confirmer.
        </Alert>
      )}

      <Card
        title={settings.enabled ? 'En ligne' : 'Hors ligne'}
        titleId="sf-switch"
        icon={Globe}
      >
        <SwitchForm
          organizationId={organization.id}
          enabled={settings.enabled}
        />
      </Card>

      {settings.enabled && url && (
        <Card title="Partager" titleId="sf-share" icon={Share2}>
          <p className="mb-3 font-bold break-all">{url}</p>
          <ShareActions url={url} shopName={organization.name} />
        </Card>
      )}

      <Card
        title="Articles sur ma vitrine"
        titleId="sf-articles"
        icon={ListChecks}
      >
        <p className="text-lg">
          <strong className="text-2xl tabular-nums">
            {settings.visibleArticles}
          </strong>{' '}
          sur {settings.articles} produits et services
        </p>
        <p className="text-ink-muted">
          Les prix d’achat et les quantités en stock ne sont jamais montrés.
        </p>
        <ButtonLink href="/espace/vitrine/articles" className="mt-3 self-start">
          Choisir les articles
        </ButtonLink>
      </Card>

      <Card
        title="Ce que voient les clients"
        titleId="sf-presentation"
        icon={Store}
      >
        <PresentationForm
          organizationId={organization.id}
          settings={settings}
          siteUrl={site}
        />
      </Card>
    </>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Storefront />
    </Suspense>
  );
}
