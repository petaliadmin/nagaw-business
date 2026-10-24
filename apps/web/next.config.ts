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
