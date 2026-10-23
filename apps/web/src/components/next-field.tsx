'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Carries `?next=` into an auth form, so that signing in or up from an
 * invitation link comes back to it. The server re-validates the path.
 */
export function NextField() {
  const next = useSearchParams().get('next');
  return next ? <input type="hidden" name="next" value={next} /> : null;
}
