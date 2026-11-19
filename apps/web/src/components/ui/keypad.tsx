import { Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/**
 * The digit keys of the app (ADR-063): the same big grey keys to type a
 * secret code, an expense or an amount, as in mobile money apps.
 */
export function Keypad({
  onPress,
  disabled = false,
  eraseDisabled = false,
  label = 'Pavé numérique',
  onSurface = false,
}: {
  /** Inside a grey card: white keys, so that they still stand out. */
  onSurface?: boolean;
  /** A digit, or `del` to erase the last one. */
  onPress: (key: string) => void;
  disabled?: boolean;
  eraseDisabled?: boolean;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid w-full grid-cols-3 gap-2"
    >
      {KEYS.map((key, index) =>
        key === '' ? (
          <span key={index} aria-hidden />
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onPress(key)}
            disabled={disabled || (key === 'del' && eraseDisabled)}
            aria-label={key === 'del' ? 'Effacer un chiffre' : undefined}
            className={`flex min-h-14 items-center justify-center rounded-2xl ${onSurface ? 'bg-canvas' : 'bg-surface'} text-2xl font-extrabold tabular-nums transition-colors active:bg-line disabled:opacity-50`}
          >
            {key === 'del' ? <Delete aria-hidden className="size-7" /> : key}
          </button>
        ),
      )}
    </div>
  );
}
