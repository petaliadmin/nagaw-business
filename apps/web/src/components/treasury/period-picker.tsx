import Link from 'next/link';
import { CONTROL } from '@/components/form-field';
import { buttonClasses } from '@/components/ui/button-styles';
import { PERIODS, type PeriodKey } from '@/lib/treasury/period';

/** Named periods as links, or two dates chosen by hand. */
export function PeriodPicker({
  path,
  current,
  from,
  to,
  extra = {},
}: {
  path: string;
  current: PeriodKey | 'perso';
  from: string;
  to: string;
  /** Other search parameters to keep (an account…). */
  extra?: Record<string, string>;
}) {
  const href = (periode: string) =>
    `${path}?${new URLSearchParams({ ...extra, periode })}`;
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Période" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={href(p.key)}
            aria-current={current === p.key ? 'true' : undefined}
            className={buttonClasses(
              current === p.key ? 'primary' : 'secondary',
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form action={path} className="flex flex-wrap items-end gap-2">
        {Object.entries(extra).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="period-from" className="text-base font-semibold">
            Du
          </label>
          <input
            id="period-from"
            name="du"
            type="date"
            defaultValue={from}
            className={CONTROL}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="period-to" className="text-base font-semibold">
            Au
          </label>
          <input
            id="period-to"
            name="au"
            type="date"
            defaultValue={to}
            className={CONTROL}
          />
        </div>
        <button type="submit" className={buttonClasses('secondary')}>
          Voir
        </button>
      </form>
    </div>
  );
}
