import { SectionLayout } from '@/components/shell/section-layout';

export default function Layout({ children }: LayoutProps<'/espace/equipe'>) {
  return <SectionLayout section="parametres">{children}</SectionLayout>;
}
