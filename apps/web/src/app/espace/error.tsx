'use client';

import { Alert } from '@/components/ui/alert';

/** Unexpected failure while rendering a page of the space. */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <Alert tone="error">
        Cette page n’a pas pu être affichée.
        {error.digest && <> Référence : {error.digest}.</>}
      </Alert>
      <div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
