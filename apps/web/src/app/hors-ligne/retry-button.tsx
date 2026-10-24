'use client';

import { RotateCw } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button-styles';

/** Reloads the page the user was trying to open. */
export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className={buttonClasses('primary', 'w-full')}
    >
      <RotateCw aria-hidden className="size-5" />
      Réessayer
    </button>
  );
}
