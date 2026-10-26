import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({ children }: LayoutProps<'/espace/ventes'>) {
  return <SectionLayout section="ventes">{children}</SectionLayout>;
}
