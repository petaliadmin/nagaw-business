import { ChevronDown, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MODULE_TONES, type ModuleTone } from '@/components/dashboard/tones';

/**
 * A card that opens on demand: forms and settings used now and then stay
 * folded, so that a phone screen shows the list first (one main action per
 * screen, DESIGN.md). Native <details>: keyboard and screen readers work
 * without script, and it stays open across a form error.
 */
export function FoldCard({
  title,
  icon: Icon,
  tone,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Module colour of the icon (brand by default). */
  tone?: ModuleTone;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <details
        open={defaultOpen || undefined}
        className="group rounded-2xl border border-line bg-surface shadow-sm"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-2 rounded-2xl p-4 text-xl font-bold md:px-6 [&::-webkit-details-marker]:hidden">
          {Icon && (
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                tone ? MODULE_TONES[tone].badge : 'bg-brand-soft text-brand-ink'
              }`}
            >
              <Icon aria-hidden className="size-5" />
            </span>
          )}
          <span className="flex-1">{title}</span>
          <ChevronDown
            aria-hidden
            className="size-6 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="px-4 pb-4 md:px-6 md:pb-6">{children}</div>
      </details>
    </section>
  );
}
