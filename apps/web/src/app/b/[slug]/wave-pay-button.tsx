'use client';

import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { launchWave } from './actions';

/**
 * « Payer avec Wave » (ADR-065): the browser itself goes to Wave, then
 * Wave sends the customer back to the payment page of the order.
 */
export function WavePayButton({
  slug,
  orderId,
}: {
  slug: string;
  orderId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pay = () => {
    setError(null);
    startTransition(async () => {
      const result = await launchWave(slug, orderId);
      if (result.ok) window.location.assign(result.url);
      else setError(result.message);
    });
  };
  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        aria-disabled={pending}
        className={buttonClasses('sell')}
      >
        {pending ? 'Ouverture de Wave…' : 'Payer avec Wave'}
      </button>
    </div>
  );
}
