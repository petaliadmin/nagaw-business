import { createElement } from 'react';
import { PAYMENT_LABELS } from '@/lib/sales/labels';
import { METHOD_PICTURES } from '@/lib/sales/method-pictures';

/** « Espèces » with its banknotes, « Mobile Money » with its phone… */
export function MethodName({
  method,
}: {
  method: keyof typeof PAYMENT_LABELS;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas"
      >
        {createElement(METHOD_PICTURES[method]!, { className: 'size-5' })}
      </span>
      {PAYMENT_LABELS[method]}
    </span>
  );
}
