import { Logo } from '@/components/ui/logo';

/**
 * Sign-in, sign-up and the other account pages (V3, ADR-064): white and
 * airy as a mobile money app, no grey box around the form; the name of
 * the app at the top, the page's own title under it.
 */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 pt-6 pb-10 md:justify-center md:pt-10">
      <Logo href="/" />
      <div className="flex flex-col gap-6">{children}</div>
    </main>
  );
}
