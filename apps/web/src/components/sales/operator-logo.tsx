import type { MobileMoneyProvider } from '@nagaw/shared';
import { Smartphone } from 'lucide-react';
import mixx from './operators/mixx.svg';
import orangeMoney from './operators/orange-money.png';
import wave from './operators/wave.png';

/**
 * The operators' own logos, taken from their websites (wave.com, orange.sn,
 * yas.sn, 2026-11-03): Free Money is now Mixx by Yas. Imported, not under
 * `public/`, so that they land in `/_next/static/` and the service worker
 * keeps them for the offline checkout. Mixx's navy is in its file, around
 * its yellow letters. Always beside the operator's name: the logo only
 * repeats it.
 */
const LOGOS: Partial<Record<MobileMoneyProvider, string>> = {
  wave: wave.src,
  orange_money: orangeMoney.src,
  free_money: mixx.src,
};

export function OperatorLogo({
  provider,
  className = 'size-8',
}: {
  provider: MobileMoneyProvider;
  className?: string;
}) {
  const logo = LOGOS[provider];
  if (!logo)
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted ${className}`}
      >
        <Smartphone className="size-5" />
      </span>
    );
  return (
    // A plain image: tiny, and already served from `/_next/static/`.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      aria-hidden
      className={`shrink-0 rounded-lg object-contain ${className}`}
    />
  );
}
