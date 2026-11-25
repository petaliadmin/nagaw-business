import type { PlanLimits } from '@nagaw/shared';
import { Check, X } from 'lucide-react';
import { planFeatures } from '@/lib/plans';

/**
 * What an offer gives, in a price grid (ADR-075): a tick for what it
 * includes, a cross and « non compris » for a module it leaves out.
 */
export function PlanFeatures({
  limits,
  grid,
}: {
  limits: PlanLimits;
  /** Every offer of the grid: only what differs between them is listed. */
  grid: readonly PlanLimits[];
}) {
  return (
    <ul className="flex flex-1 flex-col gap-2">
      {planFeatures(limits, grid).map((line) => (
        <li
          key={line.key}
          className={`flex items-start gap-2 ${line.included ? '' : 'text-ink-muted'}`}
        >
          {line.included ? (
            <Check
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-sales-ink"
            />
          ) : (
            <X aria-hidden className="mt-0.5 size-5 shrink-0" />
          )}
          <span>
            {line.text}
            {!line.included && <span className="sr-only"> : non compris</span>}
            {!line.included && <span aria-hidden> (non compris)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
