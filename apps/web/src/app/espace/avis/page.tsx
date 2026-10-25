import type { FeedbackDto } from '@nagaw/shared';
import { MessageSquareText } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { FeedbackForm } from './feedback-form';

export const metadata: Metadata = { title: 'Donner mon avis — Nagaw Business' };

const KIND_LABELS = {
  problem: 'Problème',
  idea: 'Idée',
  question: 'Question',
} as const;
const STATUS = {
  new: { label: 'Envoyé', tone: 'neutral' },
  read: { label: 'Lu par l’équipe', tone: 'brand' },
  done: { label: 'Traité', tone: 'success' },
} as const;

async function Feedback({ searchParams }: PageProps<'/espace/avis'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const from = (await searchParams).depuis;
  // Only a path of this site is kept, never a full address.
  const page =
    typeof from === 'string' && /^\/[\w\-/]*$/.test(from)
      ? from.slice(0, 200)
      : '';
  const sent = await apiAsUser<FeedbackDto[]>(accessToken, {
    path: '/feedback',
    organizationId: organization.id,
  });
  return (
    <>
      <PageHeader
        title="Donner mon avis"
        description="Un problème, une idée, une question ? L’équipe Nagaw lit chaque message."
      />
      <Card
        title="Écrire à l’équipe Nagaw"
        titleId="write"
        icon={MessageSquareText}
      >
        <FeedbackForm organizationId={organization.id} page={page} />
      </Card>
      <section aria-labelledby="sent-title" className="flex flex-col gap-3">
        <h2 id="sent-title" className="text-xl font-bold">
          Mes messages
        </h2>
        {!sent.ok ? (
          <Alert tone="error">Messages indisponibles : {sent.message}</Alert>
        ) : sent.data.length === 0 ? (
          <p className="text-ink-muted">Vous n’avez encore rien envoyé.</p>
        ) : (
          <ul aria-labelledby="sent-title" className="flex flex-col gap-2">
            {sent.data.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {KIND_LABELS[f.kind]} ·{' '}
                    {formatDateTime(f.createdAt, organization.timezone)}
                  </span>
                  <Badge tone={STATUS[f.status].tone}>
                    {STATUS[f.status].label}
                  </Badge>
                </div>
                <p className="whitespace-pre-line">{f.message}</p>
                {f.answer && (
                  <p className="rounded-xl bg-brand-soft p-3 text-brand-ink">
                    <span className="block font-bold">
                      Réponse de l’équipe Nagaw
                    </span>
                    {f.answer}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function FeedbackPage(props: PageProps<'/espace/avis'>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Feedback {...props} />
    </Suspense>
  );
}
