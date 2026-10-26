import { defineConfig, devices } from '@playwright/test';

const UNCONFIGURED_PORT = 3100;
const CONFIGURED_PORT = 3101;
const FAKE_BACKEND_PORT = 54400;

// Pre-installed browser in sandboxed environments; CI installs its own.
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};

/**
 * End-to-end tests against the production build, on two servers:
 * - unconfigured (no Supabase, no API): rendering, server-side validation
 *   and explicit "not configured" states;
 * - configured against a fake Supabase Auth + API (e2e/support): the signed-
 *   in space, with real ES256 session tokens. No bypass exists in the app.
 */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The signed-in specs share one fake backend and reset it: run files one
  // at a time so that they never see each other's changes.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      testMatch: ['auth-pages.spec.ts', 'pwa.spec.ts', 'seo.spec.ts'],
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${UNCONFIGURED_PORT}`,
        launchOptions,
      },
    },
    {
      name: 'mobile',
      testMatch: ['auth-pages.spec.ts', 'pwa.spec.ts', 'seo.spec.ts'],
      fullyParallel: true,
      use: {
        ...devices['Pixel 7'],
        baseURL: `http://localhost:${UNCONFIGURED_PORT}`,
        launchOptions,
      },
    },
    {
      name: 'app-desktop',
      testMatch: 'app/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${CONFIGURED_PORT}`,
        launchOptions,
      },
    },
    {
      // Runs after the desktop project: both share the fake backend's state.
      name: 'app-mobile',
      testMatch: 'app/*.spec.ts',
      dependencies: ['app-desktop'],
      use: {
        ...devices['Pixel 7'],
        baseURL: `http://localhost:${CONFIGURED_PORT}`,
        launchOptions,
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/fake-backend.mjs',
      url: `http://localhost:${FAKE_BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: { FAKE_BACKEND_PORT: String(FAKE_BACKEND_PORT) },
    },
    {
      command: `pnpm exec next start --port ${UNCONFIGURED_PORT}`,
      url: `http://localhost:${UNCONFIGURED_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: {
        API_URL: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      },
    },
    {
      command: `pnpm exec next start --port ${CONFIGURED_PORT}`,
      url: `http://localhost:${CONFIGURED_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: {
        API_URL: `http://localhost:${FAKE_BACKEND_PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${FAKE_BACKEND_PORT}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        SITE_URL: `http://localhost:${CONFIGURED_PORT}`,
      },
    },
  ],
});
