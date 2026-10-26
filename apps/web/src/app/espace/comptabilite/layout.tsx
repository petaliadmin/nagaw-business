import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({
  children,
}: LayoutProps<'/espace/comptabilite'>) {
  return <SectionLayout section="rapports">{children}</SectionLayout>;
}
