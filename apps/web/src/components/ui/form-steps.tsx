/**
 * Where the person is in a short task cut into steps (ADR-063): the words
 * say it, the bars only repeat them. Shared by the forms in steps.
 */
export function FormSteps({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-bold text-ink-muted">
        <span className="text-ink tabular-nums">
          Étape {step} sur {total}
        </span>{' '}
        · {label}
      </p>
      <div
        aria-hidden
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full ${index < step ? 'bg-ink' : 'bg-line'}`}
          />
        ))}
      </div>
    </div>
  );
}
