import { Logo } from '@/components/ui/logo';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Logo href="/" />
      <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-8">
        {children}
      </div>
    </main>
  );
}
