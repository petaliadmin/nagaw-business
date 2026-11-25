import { ModuleGate } from '@/components/plans/module-gate';

/** Closed when the shop's offer leaves this module out (ADR-075). */
export default function Layout({ children }: LayoutProps<'/espace/commandes'>) {
  return <ModuleGate module="orders">{children}</ModuleGate>;
}
