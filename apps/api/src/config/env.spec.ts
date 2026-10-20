import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies safe defaults for local development', () => {
    const env = loadEnv({});
    expect(env.APP_ENV).toBe('local');
    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
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
});
