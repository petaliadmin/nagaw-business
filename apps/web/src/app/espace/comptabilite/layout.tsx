import { ModuleGate } from '@/components/plans/module-gate';
import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({
  children,
}: LayoutProps<'/espace/comptabilite'>) {
  return (
    <SectionLayout section="rapports">
      <ModuleGate module="accounting">{children}</ModuleGate>
    </SectionLayout>
  );
}
