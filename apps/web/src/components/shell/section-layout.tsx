import { Suspense, type ReactNode } from 'react';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { sectionTabsFor, type Section } from './navigation';
import { SectionTabs } from './section-tabs';

const LABELS: Record<Section, string> = {
  factures: 'Factures et devis',
  rapports: 'Rapports',
  parametres: 'Paramètres',
};

async function Tabs({ section }: { section: Section }) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  return (
    <SectionTabs
      label={LABELS[section]}
      tabs={sectionTabsFor(section, workspace.organization.role)}
    />
  );
}

/** Layout of a page that belongs to a menu section with tabs. */
export function SectionLayout({
  section,
  children,
}: {
  section: Section;
  children: ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <Tabs section={section} />
      </Suspense>
      {children}
    </>
  );
}
