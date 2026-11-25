import { ModuleGate } from '@/components/plans/module-gate';
import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({
  children,
}: LayoutProps<'/espace/statistiques'>) {
  return (
    <SectionLayout section="rapports">
      <ModuleGate module="statistics">{children}</ModuleGate>
    </SectionLayout>
  );
}
