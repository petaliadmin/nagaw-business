import Link from 'next/link';

/** The move is offered, not forced: it comes back at the next sign-in. */
export function LaterLink({ next }: { next: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Link
        href={next}
        className="inline-flex min-h-12 items-center font-bold text-brand-ink underline underline-offset-4"
      >
        Plus tard
      </Link>
      <p className="text-ink-muted">
        Cette proposition reviendra à votre prochaine connexion.
      </p>
    </div>
  );
}
