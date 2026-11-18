const STEPS = 3;

/**
 * Where the seller is in a sale, on a phone (ADR-062): three touches, three
 * steps — choose, be paid, hand the ticket. The words say it; the bars only
 * repeat them. A computer shows the products and the cart side by side, so
 * nothing is shown there.
 */
export function SaleSteps({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return (
    <div className="flex flex-col gap-2 lg:hidden print:hidden">
      <p className="text-base font-bold text-ink-muted">
        <span className="text-ink tabular-nums">
          Étape {step} sur {STEPS}
        </span>{' '}
        · {label}
      </p>
      <div aria-hidden className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: STEPS }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full ${
              index < step ? 'bg-sales-strong' : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
