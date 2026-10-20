import Link from 'next/link';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Nagaw Business
      </Link>
      {children}
    </main>
  );
}
