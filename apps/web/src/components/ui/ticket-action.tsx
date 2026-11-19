import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Round actions under a ticket, side by side as in a payment app. */
export const TICKET_ACTIONS =
  'mx-auto grid w-full max-w-sm grid-cols-3 gap-2 print:hidden';

const ACTION =
  'group flex min-h-24 flex-col items-center gap-2 rounded-3xl px-1 py-2 text-center text-base leading-tight font-bold text-ink disabled:cursor-wait disabled:opacity-60';

function Face({
  icon: Icon,
  verb,
  rest,
  tone,
}: {
  icon: LucideIcon;
  verb: string;
  rest: string;
  tone: 'neutral' | 'whatsapp';
}) {
  return (
    <>
      <span
        aria-hidden
        className={`flex size-14 items-center justify-center rounded-full transition-transform group-active:scale-95 motion-reduce:transition-none ${
          tone === 'whatsapp' ? 'bg-sales-strong text-white' : 'bg-surface'
        }`}
      >
        <Icon className="size-6" />
      </span>
      {/* Two lines, one accessible name: « Envoyer en photo ». */}
      <span>
        <span className="block">{verb}</span>{' '}
        <span className="block font-semibold text-ink-muted">{rest}</span>
      </span>
    </>
  );
}

export function TicketActionButton({
  icon,
  verb,
  rest,
  busy,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  verb: string;
  rest: string;
  /** Shown instead of the words while the file is made. */
  busy?: string | null;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={ACTION}
    >
      <Face
        icon={icon}
        verb={busy ?? verb}
        rest={busy ? '' : rest}
        tone="neutral"
      />
    </button>
  );
}

export function TicketActionLink({
  icon,
  verb,
  rest,
  href,
  children,
}: {
  icon: LucideIcon;
  verb: string;
  rest: string;
  href: string;
  children?: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ACTION}>
      <Face icon={icon} verb={verb} rest={rest} tone="whatsapp" />
      {children}
    </a>
  );
}
