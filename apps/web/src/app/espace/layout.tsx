import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageFallback } from '@/components/ui/page-fallback';

export default function WorkspaceLayout({ children }: LayoutProps<'/espace'>) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
          <PageFallback label="Chargement de votre espace…" />
        </main>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
