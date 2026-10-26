import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { apiAsUser } from '@/lib/api/server';
import { unreadLabel } from '@/lib/notifications/labels';

type Tone = 'surface' | 'sidebar';

function BellLink({ count, tone }: { count: number | null; tone: Tone }) {
  return (
    <Link
      href="/espace/notifications"
      aria-label={count === null ? 'Notifications' : unreadLabel(count)}
      className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl ${
        tone === 'sidebar'
          ? 'text-white hover:bg-white/10 focus-visible:outline-white'
          : 'text-ink hover:bg-surface-muted'
      }`}
    >
      <Bell aria-hidden className="size-6" />
      {count !== null && count > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 flex min-w-6 items-center justify-center rounded-full bg-danger-strong px-1.5 text-sm font-extrabold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

async function Count({
  accessToken,
  organizationId,
  tone,
}: {
  accessToken: string;
  organizationId: string;
  tone: Tone;
}) {
  const result = await apiAsUser<{ unread: number }>(accessToken, {
    path: '/notifications/unread-count',
    organizationId,
    // The frame must never wait long for a counter.
    timeoutMs: 4000,
  });
  // Without the count, the bell still leads to the page.
  return <BellLink count={result.ok ? result.data.unread : null} tone={tone} />;
}

/** The bell of the app frame, with the number of unread notifications. */
export function NotificationBell(props: {
  accessToken: string;
  organizationId: string;
  tone: Tone;
}) {
  return (
    <Suspense fallback={<BellLink count={null} tone={props.tone} />}>
      <Count {...props} />
    </Suspense>
  );
}
