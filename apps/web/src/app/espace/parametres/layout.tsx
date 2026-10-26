import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({
  children,
}: LayoutProps<'/espace/parametres'>) {
  return <SectionLayout section="parametres">{children}</SectionLayout>;
}
