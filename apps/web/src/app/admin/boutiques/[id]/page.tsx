import {
  formatAmount,
  SUBSCRIPTION_PERIOD_LABELS,
  type AdminShopDto,
  type PlanDto,
} from '@nagaw/shared';
import {
  Archive,
  Ban,
  CalendarClock,
  Crown,
  DoorOpen,
  KeyRound,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { selectOrganization } from '@/app/espace/actions';
import { SubmitButton } from '@/components/submit-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card, Stat } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatContact, formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { closeShopAccess } from '../../actions';
import {
  ArchiveForm,
  InvoiceDecision,
  OpenAccessForm,
  RenewForm,
  SetPinForm,
  SetPlanForm,
  SubscriptionSwitch,
  SuspendForm,
} from '../../forms';

const INVOICE_STATUS = {
  pending: 'À payer',
  paid: 'Payée',
  cancelled: 'Annulée',
} as const;

const REQUEST_STATUS = {
  pending: 'En attente',
  cancelled: 'Annulée par la boutique',
  done: 'Acceptée',
  rejected: 'Refusée',
} as const;

async function Shop({ params }: PageProps<'/admin/boutiques/[id]'>) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const { id } = await params;
  const [shop, plans] = await Promise.all([
    apiAsUser<AdminShopDto>(admin.accessToken, {
      path: `/admin/shops/${encodeURIComponent(id)}`,
    }),
    apiAsUser<PlanDto[]>(admin.accessToken, { path: '/plans' }),
  ]);
  if (!shop.ok && shop.status === 404) notFound();
  if (!shop.ok)
    return <Alert tone="error">Boutique indisponible : {shop.message}</Alert>;
  const s = shop.data;
  const when = (iso: string) => `${formatDateTime(iso, 'UTC')} (UTC)`;
  return (
    <>
      <PageHeader
        title={s.name}
        description={`${s.ownerEmails.map(formatContact).join(', ') || 'Sans propriétaire actif'} · créée le ${when(s.createdAt)} · ${s.timezone} · ${s.currency}`}
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="brand">Offre {s.plan.name}</Badge>
        {s.status === 'suspended' && <Badge tone="danger">Suspendue</Badge>}
        {s.status === 'archived' && <Badge>Archivée</Badge>}
        {s.subscription.lifetime && <Badge tone="success">À vie</Badge>}
        {s.subscription.invoices.some((i) => i.status === 'pending') && (
          <Badge tone="warning">Facture à payer</Badge>
        )}
        {s.requests.some((r) => r.status === 'pending') && (
          <Badge tone="warning">Demande d’offre en attente</Badge>
        )}
      </div>
      <nav aria-label="Sur cette fiche" className="flex flex-wrap gap-2">
        {[
          ...(s.status === 'active' ? [['#access', 'Entrer']] : []),
          ['#plan', 'Offre'],
          ['#term', 'Durée et factures'],
          ['#team', 'Équipe'],
          ['#devices', 'Téléphones'],
          ...(s.status !== 'archived' ? [['#suspend', 'Suspendre']] : []),
          ['#archive', 'Archiver'],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="inline-flex min-h-12 items-center rounded-full bg-surface px-4 font-semibold hover:bg-surface-muted"
          >
            {label}
          </a>
        ))}
      </nav>
      {s.suspension && (
        <Alert tone="warning">
          Suspendue le {when(s.suspension.at)} : {s.suspension.reason}
        </Alert>
      )}
      {s.archive && (
        <Alert tone="warning">
          Archivée le {when(s.archive.at)} : {s.archive.reason}
        </Alert>
      )}
      {s.status === 'active' && (
        <Card title="Entrer dans la boutique" titleId="access" icon={DoorOpen}>
          {s.access ? (
            <div className="flex flex-col gap-4">
              <p>
                Vous y êtes depuis le {when(s.access.openedAt)} :{' '}
                {s.access.reason}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/admin/boutiques/${s.id}/donnees`}
                  className={buttonClasses('primary')}
                >
                  Gérer ses données
                </Link>
                <form action={selectOrganization}>
                  <input type="hidden" name="organizationId" value={s.id} />
                  <SubmitButton variant="secondary" pendingLabel="Ouverture…">
                    Aller dans la boutique
                  </SubmitButton>
                </form>
                <form action={closeShopAccess}>
                  <input type="hidden" name="shopId" value={s.id} />
                  <SubmitButton variant="secondary" pendingLabel="Sortie…">
                    Quitter la boutique
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-4 text-ink-muted">
                Vous verrez et ferez tout comme son propriétaire, jusqu’à ce que
                vous la quittiez : gérer ses produits, clients, ventes et
                factures depuis l’administration, ou aller dans la boutique. Le
                motif, votre entrée, votre sortie et chacune de vos actions sont
                inscrits dans son historique, au nom de « Nagaw (plateforme) ».
              </p>
              <OpenAccessForm shopId={s.id} />
            </>
          )}
        </Card>
      )}
      <Card title={`Offre ${s.plan.name}`} titleId="plan" icon={Crown}>
        <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Produits"
            value={`${s.usage.products} / ${s.limits.products ?? 'sans limite'}`}
          />
          <Stat
            label="Personnes"
            value={`${s.usage.members} / ${s.limits.members}`}
          />
          <Stat
            label="Téléphones"
            value={`${s.usage.devices} / ${s.limits.devices}`}
          />
        </dl>
        {plans.ok ? (
          <SetPlanForm
            shopId={s.id}
            currentPlan={s.plan.key}
            plans={plans.data.map((p) => ({ value: p.key, label: p.name }))}
          />
        ) : (
          <Alert tone="error">Offres indisponibles : {plans.message}</Alert>
        )}
        {s.requests.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-lg font-bold">Demandes</h3>
            <ul className="flex flex-col divide-y divide-line">
              {s.requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap justify-between gap-2 py-2"
                >
                  <span>
                    {r.from.name} → {r.to.name}, par{' '}
                    {formatContact(r.requestedBy)}, le {when(r.createdAt)}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                  <Badge tone={r.status === 'pending' ? 'warning' : 'neutral'}>
                    {REQUEST_STATUS[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card title="Durée et factures" titleId="term" icon={CalendarClock}>
        {(() => {
          const sub = s.subscription;
          const paid =
            plans.ok &&
            (plans.data.find((p) => p.key === s.plan.key)?.monthlyPrice ?? 0) >
              0;
          return (
            <div className="flex flex-col gap-4">
              <p className="text-lg font-bold">
                {sub.lifetime
                  ? 'Abonnement à vie'
                  : sub.currentPeriodEnd
                    ? `${SUBSCRIPTION_PERIOD_LABELS[sub.period]}, jusqu’au ${when(sub.currentPeriodEnd)}`
                    : 'Sans date de fin (offre gratuite)'}
              </p>
              {!sub.lifetime && sub.currentPeriodEnd && (
                <p className="text-ink-muted">
                  {sub.autoRenew
                    ? 'Renouvelé automatiquement : à la fin, une facture à payer ; sans paiement marqué après le délai, la boutique est suspendue.'
                    : 'Pas de renouvellement : la boutique repasse en Gratuit à la fin.'}
                </p>
              )}
              {!sub.lifetime && paid && <RenewForm shopId={s.id} />}
              <div className="flex flex-wrap gap-3">
                {!sub.lifetime && sub.currentPeriodEnd && (
                  <SubscriptionSwitch
                    shopId={s.id}
                    field="autoRenew"
                    value={!sub.autoRenew}
                    label={
                      sub.autoRenew
                        ? 'Arrêter le renouvellement automatique'
                        : 'Renouveler automatiquement'
                    }
                  />
                )}
                <SubscriptionSwitch
                  shopId={s.id}
                  field="lifetime"
                  value={!sub.lifetime}
                  label={
                    sub.lifetime
                      ? 'Retirer l’abonnement à vie'
                      : 'Abonnement à vie'
                  }
                  confirmation={
                    sub.lifetime
                      ? {
                          title: 'Retirer l’abonnement à vie ?',
                          message:
                            'Une période commence aujourd’hui, puis les règles habituelles : renouvellement et factures.',
                        }
                      : {
                          title: `Abonnement à vie pour ${s.name} ?`,
                          message: `Offre ${s.plan.name} sans date de fin et sans facture. Les factures en attente sont annulées.`,
                        }
                  }
                />
              </div>
              {sub.invoices.length > 0 && (
                <ul className="flex flex-col divide-y divide-line">
                  {sub.invoices.map((i) => (
                    <li key={i.id} className="flex flex-col gap-2 py-3">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {i.reference} · {i.plan.name},{' '}
                          {SUBSCRIPTION_PERIOD_LABELS[i.period]} ·{' '}
                          {formatAmount(i.amount, i.currency)}
                        </span>
                        <Badge
                          tone={
                            i.status === 'pending'
                              ? 'warning'
                              : i.status === 'paid'
                                ? 'success'
                                : 'neutral'
                          }
                        >
                          {INVOICE_STATUS[i.status]}
                        </Badge>
                      </span>
                      <span className="text-ink-muted">
                        Du {when(i.periodStart)} au {when(i.periodEnd)}
                        {i.status === 'pending'
                          ? ` · à payer avant le ${when(i.dueAt)}`
                          : ''}
                        {i.note ? ` · ${i.note}` : ''}
                      </span>
                      {i.status === 'pending' && (
                        <InvoiceDecision invoice={i} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </Card>
      <Card title="Équipe et codes secrets" titleId="team" icon={KeyRound}>
        <p className="mb-4 text-ink-muted">
          Code secret oublié : vérifiez que la personne appelle bien depuis le
          numéro de son compte, puis donnez-lui un nouveau code. Il débloque
          aussi un numéro bloqué. C’est inscrit dans l’historique de la
          boutique.
        </p>
        <ul
          aria-labelledby="team"
          className="flex flex-col divide-y divide-line"
        >
          {s.team.map((m) => (
            <li key={m.userId} className="flex flex-col gap-3 py-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold break-all">
                  {formatContact(m.contact)}
                </span>
                <Badge>{ROLE_LABELS[m.role]}</Badge>
                {!m.active && <Badge>Désactivé</Badge>}
              </span>
              {m.hasPhone ? (
                <SetPinForm
                  shopId={s.id}
                  userId={m.userId}
                  who={formatContact(m.contact)}
                />
              ) : (
                <p className="text-ink-muted">
                  Se connecte encore avec son adresse e-mail : passer au numéro
                  lui sera proposé à sa prochaine connexion.
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Téléphones de caisse" titleId="devices" icon={Smartphone}>
        {s.devices.length === 0 ? (
          <p className="text-ink-muted">Aucun téléphone enregistré.</p>
        ) : (
          <ul
            aria-labelledby="devices"
            className="flex flex-col divide-y divide-line"
          >
            {s.devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span className="font-semibold">{d.label}</span>
                <span className="text-ink-muted">
                  {d.revoked
                    ? 'Retiré'
                    : d.lastSyncedAt
                      ? `Dernier envoi : ${when(d.lastSyncedAt)}`
                      : 'Aucun envoi'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {s.status !== 'archived' && (
        <Card
          title={s.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
          titleId="suspend"
          icon={Ban}
        >
          <p className="mb-4 text-ink-muted">
            {s.status === 'suspended'
              ? 'Les membres retrouvent l’accès à la boutique, avec toutes ses données.'
              : 'Les membres n’ont plus accès à la boutique ; rien n’est effacé. Le motif est inscrit dans son historique.'}
          </p>
          <SuspendForm shopId={s.id} suspended={s.status === 'suspended'} />
        </Card>
      )}
      <Card
        title={s.status === 'archived' ? 'Restaurer' : 'Archiver'}
        titleId="archive"
        icon={Archive}
      >
        <p className="mb-4 text-ink-muted">
          {s.status === 'archived'
            ? 'La boutique revient dans les listes et ses membres la retrouvent, avec toutes ses données.'
            : 'Pour une boutique fermée pour de bon : elle sort des listes et ses membres n’y ont plus accès. Rien n’est effacé.'}
        </p>
        <ArchiveForm
          target="shop"
          targetId={s.id}
          name={s.name}
          archived={s.status === 'archived'}
        />
      </Card>
    </>
  );
}

export default function ShopPage(props: PageProps<'/admin/boutiques/[id]'>) {
  return (
    <Suspense fallback={<PageFallback variant="detail" />}>
      <Shop {...props} />
    </Suspense>
  );
}
