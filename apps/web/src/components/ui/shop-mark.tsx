'use client';

import { Store } from 'lucide-react';
import { useState } from 'react';
import { logoUrl } from './shop-logo';

/**
 * In front of the shop's name: its logo, or the default icon without one
 * or when it cannot load (offline at the checkout). Decorative: the name
 * next to it says the same.
 */
export function ShopMark({
  version,
  size = 'md',
}: {
  version: string | null | undefined;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = logoUrl(version ?? null);
  const box = size === 'sm' ? 'size-8 rounded-lg' : 'size-10 rounded-xl';
  if (src && failed !== src)
    return (
      // Proxied and versioned already: next/image adds nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(src)}
        className={`${box} shrink-0 border border-line bg-white object-contain`}
      />
    );
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center bg-brand-strong text-white`}
    >
      <Store aria-hidden className={size === 'sm' ? 'size-5' : 'size-6'} />
    </span>
  );
}
