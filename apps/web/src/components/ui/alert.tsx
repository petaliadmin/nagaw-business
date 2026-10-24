import {
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

const TONES: Record<
  'error' | 'info' | 'success' | 'warning',
  { className: string; icon: LucideIcon }
> = {
  error: {
    className: 'border-danger bg-danger-soft text-danger-ink',
    icon: TriangleAlert,
  },
  warning: {
    className: 'border-warning bg-warning-soft text-warning-ink',
    icon: TriangleAlert,
  },
  success: {
    className: 'border-sales bg-sales-soft text-sales-ink',
    icon: CircleCheck,
  },
  info: {
    className: 'border-brand bg-brand-soft text-brand-ink',
    icon: Info,
  },
};

/** Message with an icon and a color: the meaning never rests on color alone. */
export function Alert({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  const { className, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border-l-4 px-4 py-3 text-base font-medium ${className}`}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
