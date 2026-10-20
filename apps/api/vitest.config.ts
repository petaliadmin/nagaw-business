import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.integration-spec.ts'],
          globalSetup: ['test/support/global-setup.ts'],
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
