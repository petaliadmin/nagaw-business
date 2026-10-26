import type { NotificationListDto } from '@nagaw/shared';
import {
  Bell,
  BellRing,
  CircleAlert,
  Info,
  Settings2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import {
  formatWhen,
  safeNotificationLink,
  SEVERITY_TONES,
} from '@/lib/notifications/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { openNotification } from './actions';

export const metadata: Metadata = { title: 'Notifications — Nagaw Business' };

const SEVERITY_ICONS: Record<string, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
};

async function Notifications({
  searchParams,
}: PageProps<'/espace/notifications'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const raw = await searchParams;
  const cursor = typeof raw.apres === 'string' ? raw.apres : undefined;
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  const list = await apiAsUser<NotificationListDto>(accessToken, {
    path: `/notifications${query.size > 0 ? `?${query}` : ''}`,
    organizationId: organization.id,
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Ce qui demande votre attention dans la boutique, regroupé pour ne pas vous déranger à chaque vente."
        actions={
          <ButtonLink href="/espace/notifications/reglages" variant="secondary">
            <Settings2 aria-hidden className="size-5" />
            Ce que je reçois
          </ButtonLink>
        }
      />
      {!list.ok ? (
        <Alert tone="error">Notifications indisponibles : {list.message}</Alert>
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Rien de nouveau">
          {cursor
            ? 'Il n’y a pas de notification plus ancienne.'
            : 'Vous serez prévenu ici quand un produit s’épuise, quand une vente est à vérifier, et chaque soir avec le résumé de la journée.'}
        </EmptyState>
      ) : (
        <>
          {list.data.unread > 0 && (
            <form action={openNotification}>
              <input
                type="hidden"
                name="organizationId"
                value={organization.id}
              />
              <SubmitButton pendingLabel="Un instant…" variant="secondary">
                {`Tout marquer comme lu (${list.data.unread})`}
              </SubmitButton>
            </form>
          )}
          <ul aria-label="Notifications" className="flex flex-col gap-2">
            {list.data.items.map((n) => {
              const Icon = SEVERITY_ICONS[n.severity] ?? Bell;
              const tone = SEVERITY_TONES[n.severity];
              const link = safeNotificationLink(n.link);
              return (
                <li
                  key={n.id}
                  className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 ${
                    n.read
                      ? 'border-line bg-surface'
                      : 'border-brand bg-brand-soft/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      aria-hidden
                      className={`mt-1 size-6 shrink-0 ${
                        n.severity === 'danger'
                          ? 'text-danger-ink'
                          : n.severity === 'warning'
                            ? 'text-warning-ink'
                            : 'text-brand-ink'
                      }`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!n.read && <Badge tone="brand">Nouveau</Badge>}
                        {n.severity !== 'info' && (
                          <Badge tone={tone.badge}>{tone.label}</Badge>
                        )}
                        <span className="text-ink-muted">
                          {formatWhen(n.updatedAt, organization.timezone)}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold">{n.title}</h2>
                      {n.body && (
                        <p className="whitespace-pre-line break-words">
                          {n.body}
                        </p>
                      )}
                    </div>
                  </div>
                  {(link || !n.read) && (
                    <form
                      action={openNotification}
                      className="flex justify-end"
                    >
                      <input
                        type="hidden"
                        name="organizationId"
                        value={organization.id}
                      />
                      <input type="hidden" name="id" value={n.id} />
                      {link && <input type="hidden" name="link" value={link} />}
                      <SubmitButton
                        pendingLabel="Un instant…"
                        variant={link ? 'primary' : 'secondary'}
                        aria-label={`${link ? 'Voir' : 'Marquer comme lu'} : ${n.title}`}
                      >
                        {link ? 'Voir' : 'Marquer comme lu'}
                      </SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {list.data.nextCursor && (
            <Link
              href={`/espace/notifications?apres=${encodeURIComponent(list.data.nextCursor)}`}
              className={`${buttonClasses('secondary')} self-start`}
            >
              Voir les plus anciennes
            </Link>
          )}
        </>
      )}
      <Alert>
        <span className="flex items-center gap-2">
          <BellRing aria-hidden className="size-5" />
          Recevez-les aussi sur ce téléphone, même application fermée :{' '}
          <Link
            href="/espace/notifications/reglages"
            className="font-bold underline underline-offset-4"
          >
            activer
          </Link>
          .
        </span>
      </Alert>
    </>
  );
}

export default function NotificationsPage(
  props: PageProps<'/espace/notifications'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Notifications {...props} />
    </Suspense>
  );
}
