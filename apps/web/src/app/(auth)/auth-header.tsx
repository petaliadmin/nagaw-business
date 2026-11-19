import type { LucideIcon } from 'lucide-react';
import { FormSteps } from '@/components/ui/form-steps';

/**
 * The top of an account page: a big violet picture that says what the
 * page is for, the title, and one short sentence (V3, ADR-064).
 */
export function AuthHeader({
  icon: Icon,
  title,
  children,
  step,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  /** Where the person is when the page is part of the sign-up. */
  step?: { step: number; total: number; label: string };
}) {
  return (
    <div className="flex flex-col gap-5">
      {step && <FormSteps {...step} />}
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-[22px] bg-brand-strong text-white"
        >
          <Icon className="size-8" strokeWidth={2.2} />
        </span>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {children && (
          <p className="text-lg font-semibold text-ink-muted">{children}</p>
        )}
      </div>
    </div>
  );
}
