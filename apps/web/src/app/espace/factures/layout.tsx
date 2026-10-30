import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({ children }: LayoutProps<'/espace/factures'>) {
  return <SectionLayout section="factures">{children}</SectionLayout>;
}
