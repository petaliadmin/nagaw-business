import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies safe defaults for local development', () => {
    const env = loadEnv({});
    expect(env.APP_ENV).toBe('local');
    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.DATABASE_SSL).toBe('require');
  });

  it('splits and trims CORS origins', () => {
    const env = loadEnv({
      CORS_ORIGINS: 'https://a.example, https://b.example ,',
    });
    expect(env.CORS_ORIGINS).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('rejects an invalid APP_ENV and names the variable', () => {
    expect(() => loadEnv({ APP_ENV: 'staging' })).toThrow(/APP_ENV/);
  });

  it('treats empty optional URLs as absent and rejects malformed ones', () => {
    expect(loadEnv({ DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
    expect(() => loadEnv({ SUPABASE_URL: 'not a url' })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it('accepts push keys only as a complete set', () => {
    expect(loadEnv({}).VAPID_PUBLIC_KEY).toBeUndefined();
    expect(() => loadEnv({ VAPID_PUBLIC_KEY: 'BPub' })).toThrow(
      /VAPID_PUBLIC_KEY/,
    );
    expect(
      loadEnv({
        VAPID_PUBLIC_KEY: 'BPub',
        VAPID_PRIVATE_KEY: 'priv',
        VAPID_SUBJECT: 'mailto:contact@example.test',
      }).VAPID_SUBJECT,
    ).toBe('mailto:contact@example.test');
  });

  it('refuses a short cron secret', () => {
    expect(() => loadEnv({ CRON_SECRET: 'short' })).toThrow(/CRON_SECRET/);
  });
});
