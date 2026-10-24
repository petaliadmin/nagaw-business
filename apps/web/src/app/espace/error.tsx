'use client';

import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';

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
      <h1 className="text-2xl font-extrabold">Une erreur est survenue</h1>
      <Alert tone="error">
        Cette page n’a pas pu être affichée.
        {error.digest && <> Référence : {error.digest}.</>}
      </Alert>
      <div>
        <button
          type="button"
          onClick={reset}
          className={buttonClasses('secondary')}
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
