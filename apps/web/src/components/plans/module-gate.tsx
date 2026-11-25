import {
  PLAN_MODULE_DESCRIPTIONS,
  PLAN_MODULE_LABELS,
  type PlanModule,
} from '@nagaw/shared';
import { Crown } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/**
 * What a module brings, when the shop's offer does not include it
 * (ADR-075): never an empty page, and the way to another offer.
 */
export function ModuleLocked({ module }: { module: PlanModule }) {
  return (
    <>
      <PageHeader title={PLAN_MODULE_LABELS[module]} />
      <Card title="Pas compris dans votre offre" icon={Crown}>
        <p className="mb-4">{PLAN_MODULE_DESCRIPTIONS[module]}</p>
        <p className="mb-4 text-ink-muted">
          Vos données restent là : elles s’affichent dès que l’offre de la
          boutique comprend cette partie.
        </p>
        <ButtonLink href="/espace/abonnement" className="self-start">
          Voir les offres
        </ButtonLink>
      </Card>
    </>
  );
}

async function Gate({
  module,
  children,
}: {
  module: PlanModule;
  children: ReactNode;
}) {
  const workspace = await requireReadyWorkspace();
  // Without a shop, the pages say so themselves.
  if (!workspace || workspace.organization.planModules.includes(module))
    return children;
  return <ModuleLocked module={module} />;
}

/** The pages of a module, or what it brings when the offer leaves it out. */
export function ModuleGate({
  module,
  children,
}: {
  module: PlanModule;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Gate module={module}>{children}</Gate>
    </Suspense>
  );
}
