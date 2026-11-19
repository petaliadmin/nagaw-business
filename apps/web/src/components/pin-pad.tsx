'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useActionFormPending } from '@/components/action-form';
import { Keypad } from '@/components/ui/keypad';

const LENGTH = 4;

/**
 * The secret code typed on big digit keys, as in mobile money apps
 * (ADR-059). The form is sent as soon as the fourth digit is typed; the
 * code is then cleared, so a wrong one is typed again from the start.
 * A computer keyboard types too (digits, Backspace).
 */
export function PinPad({
  label = 'Code secret (4 chiffres)',
  name = 'pin',
  error,
}: {
  label?: string;
  name?: string;
  error?: string;
}) {
  const [pin, setPin] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const pending = useActionFormPending();
  const labelId = useId();
  const errorId = useId();

  const press = useCallback(
    (key: string) => {
      if (pending) return;
      if (key === 'erase') {
        setPin((p) => p.slice(0, -1));
        return;
      }
      const next = (pin + key).slice(0, LENGTH);
      if (next.length < LENGTH) {
        setPin(next);
        return;
      }
      // The form reads the field while it is submitted: the fourth digit
      // must be in it first.
      flushSync(() => setPin(next));
      input.current?.form?.requestSubmit();
      setPin('');
    },
    [pin, pending],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [press]);

  // While the code is checked, it shows as fully typed.
  const typed = pending ? LENGTH : pin.length;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col items-center gap-4"
    >
      <p id={labelId} className="text-base font-semibold">
        {label}
      </p>
      <input ref={input} type="hidden" name={name} value={pin} />
      <div aria-hidden className="flex gap-4">
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-5 rounded-full border-2 ${
              i < typed ? 'border-ink bg-ink' : 'border-line-strong'
            }`}
          />
        ))}
      </div>
      <p role="status" className="min-h-6 text-base text-ink-muted">
        {pending ? 'Vérification du code…' : null}
        <span className="sr-only">
          {pending ? '' : `${pin.length} chiffre(s) sur ${LENGTH}`}
        </span>
      </p>
      {error && (
        <p id={errorId} className="text-base font-medium text-danger-ink">
          {error}
        </p>
      )}
      <Keypad
        label="Touches du code"
        onPress={(key) => press(key === 'del' ? 'erase' : key)}
        disabled={pending}
        eraseDisabled={pin.length === 0}
      />
    </div>
  );
}
