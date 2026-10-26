import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({ children }: LayoutProps<'/espace/journal'>) {
  return <SectionLayout section="parametres">{children}</SectionLayout>;
}
