import { serviceWorkerSource } from '@/lib/pwa/service-worker-source';

// Changes with every build (next.config.ts), so that a deployment installs
// a new worker and drops the previous caches.
const VERSION = process.env.NAGAW_BUILD_ID ?? 'dev';

export function GET() {
  return new Response(serviceWorkerSource(VERSION), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
