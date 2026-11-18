'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const KEY = 'nagaw:masquer-montants';

/** Whether the amounts are hidden on this phone, if it can remember it. */
function readStored(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch (error) {
    // Private browsing or storage refused: the amounts stay shown, and the
    // choice holds for this page only.
    console.warn('Choix « Masquer » non mémorisé :', error);
    return false;
  }
}

function store(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(KEY, '1');
    else window.localStorage.removeItem(KEY);
  } catch (error) {
    console.warn('Choix « Masquer » non mémorisé :', error);
  }
}

function apply(hidden: boolean) {
  if (hidden) document.documentElement.dataset.masquer = '';
  else delete document.documentElement.dataset.masquer;
}

/**
 * « Masquer » (ADR-063): blurs every amount marked `montant-prive` when a
 * customer can see the screen at the counter, like the balance of a mobile
 * money application. Remembered on this phone; the amounts themselves are
 * never sent anywhere else.
 */
export function HideAmountsButton({
  tone = 'dark',
}: {
  tone?: 'dark' | 'light';
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const stored = readStored();
    apply(stored);
    // Sync with the choice remembered on this phone, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(stored);
  }, []);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    apply(next);
    store(next);
  };

  return (
    <button
      type="button"
      aria-pressed={hidden}
      onClick={toggle}
      className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-base font-bold ${
        tone === 'dark'
          ? 'bg-white/15 text-white focus-visible:outline-white'
          : 'bg-surface text-ink'
      }`}
    >
      {hidden ? (
        <Eye aria-hidden className="size-5" />
      ) : (
        <EyeOff aria-hidden className="size-5" />
      )}
      {hidden ? 'Afficher' : 'Masquer'}
      <span className="sr-only"> les montants</span>
    </button>
  );
}
