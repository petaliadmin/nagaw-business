import type { AdminFeedbackDto } from '@nagaw/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/admin/load';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { AnswerFeedbackForm } from '../forms';

const KIND_LABELS = {
  problem: 'Problème',
  idea: 'Idée',
  question: 'Question',
} as const;
const STATUS = {
  new: { label: 'Nouveau', tone: 'warning' },
  read: { label: 'Lu', tone: 'brand' },
  done: { label: 'Traité', tone: 'success' },
} as const;

async function Feedback({ searchParams }: PageProps<'/admin/avis'>) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;
  const all = (await searchParams).tous === '1';
  const result = await apiAsUser<AdminFeedbackDto[]>(admin.accessToken, {
    path: `/admin/feedback${all ? '' : '?status=new'}`,
  });
  return (
    <>
      <PageHeader
        title="Avis des boutiques"
        description="Problèmes, idées et questions envoyés depuis l’application."
      />
      <nav aria-label="Avis affichés" className="flex flex-wrap gap-2">
        <Link
          href="/admin/avis"
          aria-current={!all ? 'true' : undefined}
          className={buttonClasses(!all ? 'primary' : 'secondary')}
        >
          Nouveaux
        </Link>
        <Link
          href="/admin/avis?tous=1"
          aria-current={all ? 'true' : undefined}
          className={buttonClasses(all ? 'primary' : 'secondary')}
        >
          Tous
        </Link>
      </nav>
      {!result.ok ? (
        <Alert tone="error">Avis indisponibles : {result.message}</Alert>
      ) : result.data.length === 0 ? (
        <EmptyState title={all ? 'Aucun avis' : 'Aucun nouvel avis'} />
      ) : (
        <ul aria-label="Liste des avis" className="flex flex-col gap-3">
          {result.data.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex flex-col">
                  <span className="font-bold">
                    {KIND_LABELS[f.kind]} ·{' '}
                    <Link
                      href={`/admin/boutiques/${f.shop.id}`}
                      className="text-brand-ink underline underline-offset-4"
                    >
                      {f.shop.name}
                    </Link>
                  </span>
                  <span className="text-ink-muted">
                    {f.author} · {formatDateTime(f.createdAt, 'UTC')} (UTC)
                    {f.page ? ` · page ${f.page}` : ''}
                  </span>
                </span>
                <Badge tone={STATUS[f.status].tone}>
                  {STATUS[f.status].label}
                </Badge>
              </div>
              <p className="whitespace-pre-line">{f.message}</p>
              {f.answer && (
                <p className="rounded-xl bg-surface-muted p-3">
                  Réponse : {f.answer}
                </p>
              )}
              <AnswerFeedbackForm
                feedbackId={f.id}
                answered={f.answer !== ''}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminFeedbackPage(props: PageProps<'/admin/avis'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Feedback {...props} />
    </Suspense>
  );
}
