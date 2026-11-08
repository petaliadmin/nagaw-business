import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageFallback } from '@/components/ui/page-fallback';
import { ShellSkeleton } from '@/components/ui/skeleton';

export default function WorkspaceLayout({ children }: LayoutProps<'/espace'>) {
  return (
    <Suspense
      fallback={
        // The frame of the app keeps its place while the space loads.
        <ShellSkeleton>
          <PageFallback
            label="Chargement de votre espace…"
            variant="dashboard"
          />
        </ShellSkeleton>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
