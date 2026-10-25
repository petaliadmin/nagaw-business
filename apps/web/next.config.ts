import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Not a secret: versions the service worker cache (src/app/sw.js).
  env: {
    NAGAW_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now().toString(36)}`,
  },
  experimental: {
    // Keeps navigations and Server Actions pending while offline and
    // retries them when the network returns; exposes `useOffline`.
    useOffline: true,
  },
  async headers() {
    return [
      {
        // Every page (Phase 17): no framing, no MIME sniffing, no referrer
        // beyond the origin, HTTPS only, and no device feature but the
        // camera (product and receipt photos). Scripts are not restricted
        // by a CSP yet: Next.js inline scripts would need nonces.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
