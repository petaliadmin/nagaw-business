'use client';

import type { StockSuggestionDto } from '@nagaw/shared';
import { PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { dismissStockSuggestion } from '@/app/espace/produits/actions';
import { FormMessage } from '@/components/form-message';
import { SubmitButton } from '@/components/submit-button';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { initialFormState } from '@/lib/auth/form-state';

function Suggestion({
  organizationId,
  suggestion,
}: {
  organizationId: string;
  suggestion: StockSuggestionDto;
}) {
  const [state, action] = useActionState(
    dismissStockSuggestion,
    initialFormState,
  );
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface-muted p-3">
      <p>
        Vous vendez souvent <strong>{suggestion.name}</strong> :{' '}
        {suggestion.sales} ventes en {suggestion.windowDays} jours. Compter son
        stock vous dira quand en racheter.
      </p>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/espace/produits/${suggestion.productId}/modifier?compter=1`}
          className={buttonClasses('primary')}
        >
          Compter son stock
        </Link>
        {(['later', 'never'] as const).map((choice) => (
          <form key={choice} action={action}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input
              type="hidden"
              name="productId"
              value={suggestion.productId}
            />
            <input type="hidden" name="choice" value={choice} />
            <SubmitButton variant="secondary" pendingLabel="Un instant…">
              {choice === 'later' ? 'Plus tard' : 'Ne plus proposer'}
            </SubmitButton>
          </form>
        ))}
      </div>
    </li>
  );
}

/** « Compter le stock de … ? » (ADR-070): products sold often, not counted. */
export function StockSuggestions({
  organizationId,
  suggestions,
}: {
  organizationId: string;
  suggestions: StockSuggestionDto[];
}) {
  return (
    <Card
      title="Compter le stock ?"
      titleId="stock-suggestions"
      icon={PackageSearch}
      tone="stock"
    >
      <ul className="flex flex-col gap-3">
        {suggestions.map((suggestion) => (
          <Suggestion
            key={suggestion.productId}
            organizationId={organizationId}
            suggestion={suggestion}
          />
        ))}
      </ul>
    </Card>
  );
}
