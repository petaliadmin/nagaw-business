import { roleHasPermission } from '@nagaw/shared';
import { FilePlus2, FileText, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requireReadyWorkspace } from '@/lib/workspace/load';

export const metadata: Metadata = {
  title: 'Nouvelle facture ou devis — Nagaw Business',
};

function Choice({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm hover:border-invoices"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-invoices-soft text-invoices-ink">
          <Icon aria-hidden className="size-6" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-lg font-bold">{title}</span>
          <span className="text-ink-muted">{text}</span>
        </span>
      </Link>
    </li>
  );
}

async function NewDocument() {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { role } = workspace.organization;
  const canManage = roleHasPermission(role, 'documents.manage');
  const canQuote = roleHasPermission(role, 'quotes.manage');
  return (
    <>
      <PageHeader
        title="Nouvelle facture ou devis"
        description="Choisissez ce que vous voulez préparer."
      />
      {!canManage && !canQuote ? (
        <Alert>Votre rôle ne permet pas de préparer des documents.</Alert>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {canManage && (
            <Choice
              href="/espace/factures/nouvelle"
              icon={FilePlus2}
              title="Nouvelle facture"
              text="Pour demander le paiement d’un travail ou d’une vente."
            />
          )}
          {canQuote && (
            <Choice
              href="/espace/factures/devis/nouveau"
              icon={FileText}
              title="Nouveau devis"
              text="Pour donner un prix à un client avant qu’il commande."
            />
          )}
        </ul>
      )}
    </>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewDocument />
    </Suspense>
  );
}
